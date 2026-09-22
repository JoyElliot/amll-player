import {
	isLyricPageOpenedAtom,
	musicCoverAtom,
	musicCoverIsVideoAtom,
} from "@applemusic-like-lyrics/react-full";
import { cubicBezier } from "framer-motion";
import { useAtomValue } from "jotai";
import {
	createContext,
	type PropsWithChildren,
	type RefObject,
	useContext,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import styles from "./index.module.css";
import { createInfoMotion, type InfoPose } from "./info-motion";

type Rect = Pick<DOMRect, "left" | "top" | "width" | "height">;
type Presentation = {
	opened: boolean;
	appRef: RefObject<HTMLDivElement | null>;
	barRef: RefObject<HTMLDivElement | null>;
	compactCoverRef: RefObject<HTMLDivElement | null>;
	compactVideoRef: RefObject<HTMLVideoElement | null>;
	compactInfoRef: RefObject<HTMLDivElement | null>;
	compactInfoSlotRef: RefObject<HTMLDivElement | null>;
	fullInfoRef: (node: HTMLDivElement | null) => void;
	videoRef: RefObject<HTMLVideoElement | null>;
	openButtonRef: RefObject<HTMLButtonElement | null>;
	pageRef: (node: HTMLDivElement | null) => void;
	coverRef: (node: HTMLDivElement | null) => void;
	coverFrameRef: (node: HTMLDivElement | null) => void;
	collapseButtonRef: (node: HTMLButtonElement | null) => void;
};

const PresentationContext = createContext<Presentation | null>(null);

export function usePlaybackPresentation() {
	const value = useContext(PresentationContext);
	if (!value) throw new Error("PlaybackTransition is missing");
	return value;
}

const mix = (from: number, to: number, progress: number) =>
	from + (to - from) * progress;
const sheetEase = cubicBezier(0.32, 0.72, 0.35, 1);
const mixRect = (from: Rect, to: Rect, progress: number): Rect => ({
	left: mix(from.left, to.left, progress),
	top: mix(from.top, to.top, progress),
	width: mix(from.width, to.width, progress),
	height: mix(from.height, to.height, progress),
});

/** One presentation timeline. The playback atom remains the only requested state. */
export function PlaybackTransition({ children }: PropsWithChildren) {
	const opened = useAtomValue(isLyricPageOpenedAtom);
	const coverUrl = useAtomValue(musicCoverAtom);
	const coverIsVideo = useAtomValue(musicCoverIsVideoAtom);
	const appRef = useRef<HTMLDivElement>(null);
	const barRef = useRef<HTMLDivElement>(null);
	const compactCoverRef = useRef<HTMLDivElement>(null);
	const compactVideoRef = useRef<HTMLVideoElement>(null);
	const compactInfoRef = useRef<HTMLDivElement>(null);
	const compactInfoSlotRef = useRef<HTMLDivElement>(null);
	const [fullInfo, setFullInfo] = useState<HTMLDivElement | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const openButtonRef = useRef<HTMLButtonElement>(null);
	const [page, setPage] = useState<HTMLDivElement | null>(null);
	const [cover, setCover] = useState<HTMLDivElement | null>(null);
	const [coverFrame, setCoverFrame] = useState<HTMLDivElement | null>(null);
	const [collapseButton, setCollapseButton] =
		useState<HTMLButtonElement | null>(null);
	const [reducedMotion, setReducedMotion] = useState(
		() => matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	const progress = useRef(opened ? 1 : 0);
	const displayedCover = useRef<Rect | null>(null);
	const displayedInfo = useRef<InfoPose | null>(null);
	const previousFocus = useRef<HTMLElement | null>(null);
	const wasOpened = useRef(false);

	const presentation = useMemo<Presentation>(
		() => ({
			opened,
			appRef,
			barRef,
			compactCoverRef,
			compactVideoRef,
			compactInfoRef,
			compactInfoSlotRef,
			fullInfoRef: setFullInfo,
			videoRef,
			openButtonRef,
			pageRef: setPage,
			coverRef: setCover,
			coverFrameRef: setCoverFrame,
			collapseButtonRef: setCollapseButton,
		}),
		[opened],
	);

	useLayoutEffect(() => {
		const media = matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReducedMotion(media.matches);
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);

	useLayoutEffect(() => {
		if (!page) return;
		let focusFrame = 0;
		if (opened) {
			if (!wasOpened.current) {
				previousFocus.current =
					document.activeElement instanceof HTMLElement
						? document.activeElement
						: null;
			}
			page.dataset.phase = progress.current === 1 ? "open" : "moving";
			// A responsive layout can replace the focused collapse button.
			if (
				!wasOpened.current ||
				document.activeElement === document.body ||
				document.activeElement === page
			) {
				page.focus({ preventScroll: true });
				// Motion temporarily hides its layout while measuring it.
				focusFrame = requestAnimationFrame(() => {
					if (document.activeElement === page)
						collapseButton?.focus({ preventScroll: true });
				});
			}
		} else if (wasOpened.current) {
			const target = previousFocus.current;
			if (target?.isConnected && !target.closest("[inert]"))
				target.focus({ preventScroll: true });
			else openButtonRef.current?.focus({ preventScroll: true });
		}
		wasOpened.current = opened;
		return () => cancelAnimationFrame(focusFrame);
	}, [opened, page, collapseButton]);

	useLayoutEffect(() => {
		const app = appRef.current;
		const bar = barRef.current;
		const compact = compactCoverRef.current;
		const compactButton = openButtonRef.current;
		if (!app || !page || !bar || !compact) return;

		const target = opened ? 1 : 0;
		let startProgress = progress.current;
		let startTime = performance.now();
		let startCover = displayedCover.current;
		let animationFrame = 0;
		let material: Animation | undefined;
		let cancelVideoHandoff: (() => void) | undefined;
		let promoted = false;
		let infoMotion: ReturnType<typeof createInfoMotion>;
		const nativeRect = cover?.getBoundingClientRect();
		let nativeTransform = new DOMMatrixReadOnly();

		const paintPage = (value: number) => {
			app.style.setProperty("--player-open-progress", `${value}`);
			page.style.setProperty("--player-open-progress", `${value}`);
			const compactHeight = bar.getBoundingClientRect().height + 1;
			app.style.setProperty("--player-compact-height", `${compactHeight}px`);
			const barTop = window.innerHeight - compactHeight;
			page.style.setProperty("--player-sheet-top", `${barTop}px`);
			page.dataset.phase =
				value === 0 && !opened ? "closed" : value === 1 ? "open" : "moving";
		};

		const restoreCover = () => {
			material?.cancel();
			if (!cover || !promoted) return;
			cover.style.transition = "none";
			if (cover.matches(":popover-open")) cover.hidePopover();
			cover.removeAttribute("popover");
			for (const name of [
				"left",
				"top",
				"width",
				"height",
				"mask-image",
				"mask-composite",
				"--player-cover-compact",
				"transform",
			]) {
				cover.style.removeProperty(name);
			}
			// Apply the native pose before re-enabling the Cover's own transitions.
			cover.getBoundingClientRect();
			cover.style.removeProperty("transition");
			compactButton?.style.removeProperty("opacity");
			promoted = false;
		};

		const finish = () => {
			progress.current = target;
			paintPage(target);
			infoMotion?.restore();
			infoMotion = undefined;
			displayedInfo.current = null;
			if (opened && document.activeElement === page)
				collapseButton?.focus({ preventScroll: true });
			const release = () => {
				cancelVideoHandoff?.();
				restoreCover();
				displayedCover.current = null;
			};
			const video = videoRef.current;
			const thumbnail = compactVideoRef.current;
			if (target === 0) video?.pause();
			if (
				target === 0 &&
				video &&
				thumbnail &&
				video.readyState >= 2 &&
				!thumbnail.error
			) {
				// Keep the real cover visible until the compact video has the same frame.
				const seek = () => {
					if (Math.abs(thumbnail.currentTime - video.currentTime) >= 0.001)
						thumbnail.currentTime = video.currentTime;
					if (
						!promoted ||
						(Math.abs(thumbnail.currentTime - video.currentTime) < 0.001 &&
							!thumbnail.seeking &&
							thumbnail.readyState >= 2)
					)
						release();
				};
				cancelVideoHandoff = () => {
					thumbnail.removeEventListener("loadedmetadata", seek);
					thumbnail.removeEventListener("loadeddata", seek);
					thumbnail.removeEventListener("seeked", seek);
					thumbnail.removeEventListener("error", release);
					thumbnail.removeEventListener("emptied", release);
				};
				thumbnail.addEventListener("loadedmetadata", seek);
				thumbnail.addEventListener("loadeddata", seek);
				thumbnail.addEventListener("seeked", seek);
				thumbnail.addEventListener("error", release, { once: true });
				thumbnail.addEventListener("emptied", release, { once: true });
				if (thumbnail.readyState >= 1) seek();
			} else release();
		};

		// Responsive layouts replace their cover nodes in a layout effect.
		// Retain the current pose until the new public refs arrive.
		if (!cover || !coverFrame) return;
		if (
			reducedMotion ||
			startProgress === target ||
			typeof cover.showPopover !== "function"
		) {
			finish();
			return () => cancelVideoHandoff?.();
		}

		const refreshNativeStyle = () => {
			material?.cancel();
			cover.style.transition = "none";
			cover.style.removeProperty("transform");
			const nativeStyle = getComputedStyle(cover);
			nativeTransform = new DOMMatrixReadOnly(nativeStyle.transform);
			material = cover.animate(
				[{ filter: "none" }, { filter: nativeStyle.filter }],
				{
					duration: 1000,
					fill: "both",
				},
			);
			material.pause();
			material.currentTime = progress.current * 1000;
			cover.style.transform = "none";
		};
		refreshNativeStyle();
		if (!opened) videoRef.current?.pause();
		cover.setAttribute("popover", "manual");
		cover.showPopover();
		if (compactButton) compactButton.style.opacity = "0";
		promoted = true;
		if (compactInfoRef.current && compactInfoSlotRef.current && fullInfo) {
			infoMotion = createInfoMotion(
				compactInfoRef.current,
				compactInfoSlotRef.current,
				fullInfo,
				page,
				opened,
				displayedInfo.current,
			);
		}

		const readTarget = (): Rect => {
			if (!opened) return compact.getBoundingClientRect();
			const frame = coverFrame.getBoundingClientRect();
			// The anchor stays in layout while the real cover paints in the top layer.
			return {
				left: frame.left + (frame.width * (1 - nativeTransform.a)) / 2,
				top:
					frame.top -
					page.getBoundingClientRect().top +
					(frame.height * (1 - nativeTransform.d)) / 2,
				width: frame.width * nativeTransform.a,
				height: frame.height * nativeTransform.d,
			};
		};

		if (!startCover) {
			startCover = opened
				? compact.getBoundingClientRect()
				: (nativeRect ?? null);
		}

		const paint = (elapsed = 0) => {
			const value = progress.current;
			paintPage(value);
			if (!promoted || !startCover) return;
			const fraction =
				target === startProgress
					? 1
					: (value - startProgress) / (target - startProgress);
			const rect = mixRect(startCover, readTarget(), fraction);
			if (infoMotion)
				displayedInfo.current = infoMotion.paint(fraction, value, elapsed);
			displayedCover.current = rect;
			Object.assign(cover.style, {
				left: `${rect.left}px`,
				top: `${rect.top}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`,
			});
			cover.style.setProperty("--player-cover-compact", `${1 - value}`);
			if (material) material.currentTime = value * 1000;
			const mask = getComputedStyle(coverFrame).maskImage;
			if (mask !== "none") {
				const solid = `linear-gradient(rgb(0 0 0 / ${1 - value}), rgb(0 0 0 / ${1 - value}))`;
				cover.style.maskImage = `${mask}, ${solid}`;
				cover.style.maskComposite = "add";
			} else {
				cover.style.removeProperty("mask-image");
				cover.style.removeProperty("mask-composite");
			}
		};

		const tick = (now: number) => {
			// Keep the geometry aligned with the bar's delayed 320–500ms reveal,
			// including an interrupted transition that starts between endpoints.
			const duration = 500;
			const elapsed = Math.min(1, (now - startTime) / duration);
			const eased = sheetEase(elapsed);
			progress.current = mix(startProgress, target, eased);
			paint(elapsed);
			if (elapsed < 1) animationFrame = requestAnimationFrame(tick);
			else finish();
		};
		const resize = () => {
			if (!promoted) return;
			startProgress = progress.current;
			startCover = displayedCover.current;
			startTime = performance.now();
			infoMotion?.rebase();
			refreshNativeStyle();
			paint();
		};
		// Pause/resume changes the native Cover class while our inline pose is active.
		const appearanceObserver = new MutationObserver(resize);
		appearanceObserver.observe(cover, {
			attributes: true,
			attributeFilter: ["class"],
		});

		paint();
		animationFrame = requestAnimationFrame(tick);
		window.addEventListener("resize", resize);
		window.visualViewport?.addEventListener("resize", resize);
		return () => {
			cancelAnimationFrame(animationFrame);
			cancelVideoHandoff?.();
			infoMotion?.restore();
			appearanceObserver.disconnect();
			window.removeEventListener("resize", resize);
			window.visualViewport?.removeEventListener("resize", resize);
			restoreCover();
		};
	}, [
		opened,
		reducedMotion,
		page,
		cover,
		coverFrame,
		coverUrl,
		coverIsVideo,
		collapseButton,
		fullInfo,
	]);

	return (
		<PresentationContext.Provider value={presentation}>
			{children}
		</PresentationContext.Provider>
	);
}

export const sharedCoverClassName = styles.sharedCover;
