import { cubicBezier } from "framer-motion";

export type InfoPose = {
	left: number;
	top: number;
	width: number;
	height: number;
	fontSize: number;
	lineHeight: number;
};

export type Animate = (
	element: Element,
	keyframes: Keyframe[],
	options?: KeyframeAnimationOptions,
) => Animation;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const returnHorizontalEase = cubicBezier(0.25, 0.1, 0.25, 1);

/** Measure once, then let the browser move the existing text along sampled timing curves. */
export function createInfoMotion(
	source: HTMLDivElement,
	slot: HTMLDivElement,
	destination: HTMLDivElement,
	page: HTMLDivElement,
	opening: boolean,
	previous: InfoPose | null,
) {
	const measure = (node: HTMLElement, full = false): InfoPose => {
		const rect = node.getBoundingClientRect();
		const style = getComputedStyle(node);
		return {
			left: rect.left,
			top: rect.top - (full ? page.getBoundingClientRect().top : 0),
			width: rect.width,
			height: rect.height,
			fontSize: Number.parseFloat(style.fontSize),
			lineHeight: Number.parseFloat(style.lineHeight),
		};
	};
	const compact = () => measure(slot);
	const full = () => measure(destination, true);
	const name = source.firstElementChild;
	const fullName = destination.firstElementChild;
	if (
		!name ||
		!fullName ||
		name.textContent !== fullName.textContent ||
		full().height === 0 ||
		typeof source.showPopover !== "function"
	)
		return;
	// This transition owns the text. Freeze the library's delayed slide at its
	// destination so it does not keep moving underneath the shared text handoff.
	const owner = destination.parentElement;
	const previousOwner = owner?.getAttribute("data-player-info-motion");
	owner?.setAttribute("data-player-info-motion", "");
	const nameStyle = getComputedStyle(fullName);
	const artist = source.children[1];
	const fullArtist = destination.children[1];
	const nameWeight = Number.parseFloat(nameStyle.fontWeight);
	const nameOpacity = Number.parseFloat(nameStyle.opacity);
	const letterSpacing = Number.parseFloat(nameStyle.letterSpacing) || 0;
	const artistOpacity =
		artist && fullArtist
			? Number.parseFloat(getComputedStyle(fullArtist).opacity)
			: 0;
	const start = previous ?? (opening ? compact() : full());
	const target = opening ? full() : compact();
	const visibility = destination.style.visibility;
	const animations: Animation[] = [];
	destination.style.visibility = "hidden";
	source.setAttribute("popover", "manual");
	source.showPopover();
	source.style.left = "0px";
	source.style.top = "0px";

	return {
		play(animate: Animate, ease: (t: number) => number, startProgress: number) {
			const frames: Keyframe[] = [];
			for (let i = 0; i <= 60; i++) {
				const elapsed = i / 60;
				const fraction = ease(elapsed);
				const horizontal = opening
					? fraction * fraction
					: returnHorizontalEase(elapsed);
				const vertical = opening
					? fraction * fraction
					: 1 - (1 - fraction) * (1 - fraction);
				frames.push({
					offset: elapsed,
					transform: `translate(${mix(start.left, target.left, horizontal)}px, ${mix(start.top, target.top, vertical)}px)`,
					width: `${mix(start.width, target.width, horizontal)}px`,
					height: `${mix(start.height, target.height, horizontal)}px`,
					fontSize: `${mix(start.fontSize, target.fontSize, horizontal)}px`,
					lineHeight: `${mix(start.lineHeight, target.lineHeight, horizontal)}px`,
				});
			}
			animations.push(animate(source, frames, { easing: "linear" }));
			const endProgress = opening ? 1 : 0;
			animations.push(
				animate(
					name,
					[startProgress, endProgress].map((p) => ({
						fontWeight: mix(400, nameWeight, p),
						opacity: mix(1, nameOpacity, p),
						letterSpacing: `${letterSpacing * p}px`,
					})),
				),
			);
			if (artist)
				animations.push(
					animate(
						artist,
						[startProgress, endProgress].map((p) => ({
							opacity: mix(1, artistOpacity, p),
							letterSpacing: `${letterSpacing * p}px`,
						})),
					),
				);
		},
		capture: () => measure(source),
		readTarget: () => (opening ? full() : compact()),
		restore() {
			// Keep the final pose through hidePopover; cancel before the native handoff paints.
			if (source.matches(":popover-open")) source.hidePopover();
			for (const animation of animations) animation.cancel();
			source.removeAttribute("popover");
			source.style.removeProperty("left");
			source.style.removeProperty("top");
			destination.style.visibility = visibility;
			if (previousOwner == null)
				owner?.removeAttribute("data-player-info-motion");
			else owner?.setAttribute("data-player-info-motion", previousOwner);
		},
	};
}
