import "../src/styles.css";
import {
	cssBackgroundPropertyAtom,
	hideLyricViewAtom,
	isLyricPageOpenedAtom,
	lyricBackgroundRendererAtom,
	lyricFontFamilyAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicCoverIsVideoAtom,
	musicLyricLinesAtom,
	musicNameAtom,
	musicPlayingAtom,
	onPlayOrResumeAtom,
	VerticalCoverLayout,
	verticalCoverLayoutAtom,
} from "@applemusic-like-lyrics/react-full";
import { Theme } from "@radix-ui/themes";
import { createStore, Provider } from "jotai";
import { StrictMode, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import styles from "../src/App.module.css";
import AMLLWrapper from "../src/components/AMLLWrapper";
import { AppContainer } from "../src/components/AppContainer";
import { NowPlayingBar } from "../src/components/NowPlayingBar";
import {
	PlaybackTransition,
	usePlaybackPresentation,
} from "../src/components/PlaybackTransition";

const store = createStore();
const cover = (color: string, title: string) =>
	`data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#18213c"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="250" r="130" fill="none" stroke="#fff9" stroke-width="3"/><text x="300" y="465" font-family="sans-serif" font-size="48" text-anchor="middle" fill="white">${title}</text></svg>`)}`;
const covers = [cover("#be6765", "DUSK"), cover("#437e97", "TIDE")];
// A local moving source exercises the actual <video>, without remote media.
async function makeVideo() {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 256;
	const context = canvas.getContext("2d")!;
	const stream = canvas.captureStream(15);
	const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => chunks.push(event.data);
	const done = new Promise<string>((resolve) => {
		recorder.onstop = () => {
			stream.getTracks().forEach((track) => {
				track.stop();
			});
			resolve(URL.createObjectURL(new Blob(chunks, { type: "video/webm" })));
		};
	});
	recorder.start();
	const start = performance.now();
	const draw = (now: number) => {
		context.fillStyle = "#45677e";
		context.fillRect(0, 0, 256, 256);
		context.fillStyle = "#edd5b6";
		context.beginPath();
		context.arc(
			128 + 60 * Math.sin((now - start) / 200),
			128,
			40,
			0,
			Math.PI * 2,
		);
		context.fill();
		if (now - start < 1200) requestAnimationFrame(draw);
		else recorder.stop();
	};
	requestAnimationFrame(draw);
	return done;
}
store.set(musicCoverAtom, covers[0]);
store.set(musicNameAtom, "Dusk, in Motion");
store.set(musicArtistsAtom, [{ name: "Transition Study", id: "test" }]);
store.set(lyricBackgroundRendererAtom, { renderer: "css-bg" });
store.set(
	cssBackgroundPropertyAtom,
	"radial-gradient(at 20% 20%, #8b4e54, #17213c)",
);
store.set(musicPlayingAtom, true);
store.set(
	musicLyricLinesAtom,
	[
		"夜色慢慢铺开",
		"让旋律陪着我们",
		"越过安静的街道",
		"向着有光的地方",
		"把这一刻留下",
	].map((word, index) => ({
		words: [{ word, startTime: index * 5000, endTime: (index + 1) * 5000 }],
		startTime: index * 5000,
		endTime: (index + 1) * 5000,
		translatedLyric: "",
		romanLyric: "",
		isBG: false,
		isDuet: false,
	})),
);
store.set(hideLyricViewAtom, false);
store.set(verticalCoverLayoutAtom, VerticalCoverLayout.Auto);
store.set(onPlayOrResumeAtom, {
	onEmit: () => store.set(musicPlayingAtom, !store.get(musicPlayingAtom)),
});

function Surface() {
	const { appRef, opened } = usePlaybackPresentation();
	return (
		<div ref={appRef} className={styles.body}>
			<AppContainer
				playbar={<NowPlayingBar />}
				playbarExpanded={opened}
				playbarExpandedContent={<AMLLWrapper />}
			>
				<main style={{ padding: "8vh 10vw" }}>
					<h1>播放页过渡验证</h1>
					<p>
						此页挂载真实底栏、AMLLWrapper、歌词库和过渡控制器，不连接音频服务。
					</p>
					<button type="button" id="outside-content-button">
						可聚焦的内容按钮
					</button>
				</main>
			</AppContainer>
		</div>
	);
}

function TestControls() {
	const [result, setResult] = useState("尚未运行");
	const [videoUrl, setVideoUrl] = useState("");
	const [changeDuringTransition, setChangeDuringTransition] = useState(false);
	const run = async () => {
		const checks: string[] = [];
		const check = (condition: boolean, label: string) => {
			if (!condition) throw new Error(label);
			checks.push(label);
		};
		const button = () =>
			document.querySelector<HTMLButtonElement>(
				"[aria-controls='amll-lyric-player-wrapper']",
			)!;
		const page = () => document.getElementById("amll-lyric-player-wrapper")!;
		const cover = () => document.getElementById("amll-player-cover")!;
		const sheet = () => document.getElementById("amll-player-sheet")!;
		const content = () => document.getElementById("amll-player-content")!;
		const bar = () => document.getElementById("amll-now-playing-bar")!;
		const info = () => document.getElementById("amll-compact-info")!;
		const fullInfo = () => document.getElementById("amll-full-info")!;
		const textAppearance = (root: HTMLElement, includeSize = true) =>
			JSON.stringify(
				[...root.children].map((row) => {
					const style = getComputedStyle(row);
					return {
						text: row.textContent,
						fontFamily: style.fontFamily,
						fontSize: includeSize ? style.fontSize : undefined,
						fontWeight: style.fontWeight,
						lineHeight: includeSize ? style.lineHeight : undefined,
						letterSpacing: style.letterSpacing,
						opacity: style.opacity,
						color: style.color,
						separators: [...row.querySelectorAll("a")].map(
							(artist) => getComputedStyle(artist, "::after").content,
						),
					};
				}),
			);
		type Point = { left: number; top: number };
		let path: { start: Point; end: Point; linear?: boolean } | undefined;
		let pathError = 0;
		let motionSamples = 0;
		let lastPoint: Point | undefined;
		const settle = (ms = 650) =>
			new Promise<void>((resolve) => {
				const start = performance.now();
				const frame = () => {
					if (path && info().matches(":popover-open")) {
						const text = info().getBoundingClientRect();
						const dx = path.end.left - path.start.left;
						const dy = path.end.top - path.start.top;
						const length = Math.hypot(dx, dy);
						if (path.linear === false) {
							for (const key of ["left", "top"] as const) {
								const direction = Math.sign(path.end[key] - path.start[key]);
								pathError = Math.max(
									pathError,
									Math.min(path.start[key], path.end[key]) - text[key],
									text[key] - Math.max(path.start[key], path.end[key]),
									lastPoint ? direction * (lastPoint[key] - text[key]) : 0,
								);
							}
							lastPoint = text;
						} else if (length > 1) {
							const x = text.left - path.start.left;
							const y = text.top - path.start.top;
							const along = (x * dx + y * dy) / length;
							pathError = Math.max(
								pathError,
								Math.abs(x * dy - y * dx) / length,
								-along,
								along - length,
							);
						}
						motionSamples++;
					}
					if (performance.now() - start >= ms) resolve();
					else requestAnimationFrame(frame);
				};
				requestAnimationFrame(frame);
			});
		const setOpen = (opened: boolean) =>
			flushSync(() => store.set(isLyricPageOpenedAtom, opened));
		const near = (a: DOMRect, b: DOMRect) =>
			["left", "top", "width", "height"].every(
				(key) => Math.abs(a[key as "left"] - b[key as "left"]) < 1,
			);
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		let releaseVideoWait: (() => void) | undefined;
		try {
			setResult("运行中");
			setOpen(false);
			await settle();
			check(page().inert, "关闭页面不可交互");
			check(
				getComputedStyle(info()).fontSize === "16px" &&
					getComputedStyle(info()).lineHeight === "20px",
				"底栏字号固定16px，行高固定20px",
			);
			check(
				textAppearance(info(), false) === textAppearance(fullInfo(), false),
				"底栏和全屏共用字体外观与歌手分隔，允许字号不同",
			);
			const closedBeforeFocus = sheet().getBoundingClientRect();
			button().scrollIntoView({ block: "center", inline: "nearest" });
			check(
				near(sheet().getBoundingClientRect(), closedBeforeFocus),
				"底栏聚焦或滚入视图不会滚动整张卡片",
			);
			const nativeCover = cover();
			const nativeVideo = nativeCover.querySelector("video");
			button().focus();
			const sourceRect = button().getBoundingClientRect();
			const sourceInfoRect = info().getBoundingClientRect();
			const sourceFontSize = Number.parseFloat(
				getComputedStyle(info()).fontSize,
			);
			const backdrop = document
				.getElementById("outside-content-button")!
				.closest("main")!.parentElement!;
			const backdropRect = backdrop.getBoundingClientRect();
			const closedSheet = sheet().getBoundingClientRect();
			const openedAt = performance.now();
			flushSync(() => button().click());
			const coverLayoutSize = [
				nativeCover.offsetWidth,
				nativeCover.offsetHeight,
			];
			const sheetLayoutHeight = sheet().offsetHeight;
			const fullInfoRect = fullInfo().getBoundingClientRect();
			path = {
				start: sourceInfoRect,
				end: {
					left: fullInfoRect.left,
					top: fullInfoRect.top - page().getBoundingClientRect().top,
				},
			};
			check(page().contains(document.activeElement), "展开后焦点进入播放页");
			if (!reduced) {
				check(nativeCover.matches(":popover-open"), "真实封面进入顶层");
				check(
					info().matches(":popover-open") &&
						near(info().getBoundingClientRect(), sourceInfoRect),
					"现有歌曲信息从底栏原位平移出发",
				);
				check(
					Math.abs(sheet().getBoundingClientRect().top - closedSheet.top) < 1,
					"卡片从原底栏分隔线开始展开",
				);
				check(
					getComputedStyle(button()).opacity === "0",
					"移动封面时连同原按钮底色一起隐藏",
				);
				check(
					near(nativeCover.getBoundingClientRect(), sourceRect),
					"展开起点与底栏重合",
				);
			}
			let handoff: { before: DOMRect; after: DOMRect } | undefined;
			let infoHandoff: { before: DOMRect; after: DOMRect } | undefined;
			let textHandoff: { before: string; after: string } | undefined;
			let openDuration = 0;
			let closeDuration = 0;
			const nativeInfo = info();
			const hideInfo = nativeInfo.hidePopover;
			nativeInfo.hidePopover = () => {
				openDuration = performance.now() - openedAt;
				const before = nativeInfo.getBoundingClientRect();
				const textBefore = textAppearance(nativeInfo);
				hideInfo.call(nativeInfo);
				queueMicrotask(() => {
					infoHandoff = { before, after: fullInfo().getBoundingClientRect() };
					textHandoff = {
						before: textBefore,
						after: textAppearance(fullInfo()),
					};
				});
			};
			const hidePopover = nativeCover.hidePopover;
			nativeCover.hidePopover = () => {
				const before = nativeCover.getBoundingClientRect();
				hidePopover.call(nativeCover);
				queueMicrotask(() => {
					handoff = { before, after: nativeCover.getBoundingClientRect() };
				});
			};
			if (!reduced) {
				await settle(80);
				check(
					textAppearance(info(), false) === textAppearance(fullInfo(), false),
					"展开途中字重字距等外观与歌手分隔保持全屏样式",
				);
				const movingFontSize = Number.parseFloat(
					getComputedStyle(info()).fontSize,
				);
				const fullFontSize = Number.parseFloat(
					getComputedStyle(fullInfo()).fontSize,
				);
				check(
					Math.abs(fullFontSize - sourceFontSize) < 0.01 ||
						(movingFontSize > Math.min(sourceFontSize, fullFontSize) &&
							movingFontSize < Math.max(sourceFontSize, fullFontSize)),
					"展开途中字号连续变化，处于底栏与全屏尺寸之间",
				);
				const movingSheet = sheet().getBoundingClientRect();
				const movingCover = nativeCover.getBoundingClientRect();
				const movingInfo = info().getBoundingClientRect();
				const targetInfo = fullInfo().getBoundingClientRect();
				check(
					sheet().offsetHeight === sheetLayoutHeight &&
						nativeCover.offsetWidth === coverLayoutSize[0] &&
						nativeCover.offsetHeight === coverLayoutSize[1],
					"卡片和封面保持布局尺寸，以变换完成拉起和缩放",
				);
				const deltaX = targetInfo.left - sourceInfoRect.left;
				const deltaY =
					targetInfo.top -
					page().getBoundingClientRect().top -
					sourceInfoRect.top;
				check(
					Math.abs(backdrop.getBoundingClientRect().top - backdropRect.top) <
						1 && backdrop.getBoundingClientRect().height < backdropRect.height,
					"背景保持顶部锚点并向上收缩",
				);
				check(
					Math.abs(deltaX) < 20 ||
						Math.abs(deltaY) < 20 ||
						Math.abs(
							(movingInfo.left - sourceInfoRect.left) / deltaX -
								(movingInfo.top - sourceInfoRect.top) / deltaY,
						) < 0.01,
					"歌曲信息横纵坐标按同一进度直线平移",
				);
				check(
					(closedSheet.top - movingSheet.top) / closedSheet.top < 0.47,
					`起步曲线放缓，未改变总时长（${Math.round(performance.now() - openedAt)}ms，${((closedSheet.top - movingSheet.top) / closedSheet.top).toFixed(3)}）`,
				);
				const textProgress =
					((movingInfo.left - sourceInfoRect.left) * deltaX +
						(movingInfo.top - sourceInfoRect.top) * deltaY) /
					(deltaX * deltaX + deltaY * deltaY);
				const sheetProgress =
					(closedSheet.top - movingSheet.top) / closedSheet.top;
				check(
					textProgress > 0 && textProgress < sheetProgress * 0.65,
					"展开时文字起步慢于封面，给封面先上移的空间",
				);
				check(
					movingSheet.top > 0 && movingSheet.top < closedSheet.top,
					"卡片上边界连续上移",
				);
				check(
					Math.abs(page().getBoundingClientRect().top - movingSheet.top) < 1 &&
						Math.abs(content().getBoundingClientRect().top - movingSheet.top) <
							1,
					"歌词内容随同一张卡片上移而非原地裁切",
				);
				check(
					movingCover.top >= movingSheet.top &&
						movingCover.top < sourceRect.top &&
						Math.abs(movingCover.width - sourceRect.width) > 0.1,
					"中间帧封面从底栏位移缩放且保持在卡片内",
				);
				check(
					[...bar().querySelectorAll<HTMLElement>("[data-player-reveal]")]
						.filter((node) => node.getClientRects().length > 0)
						.every(
							(node) =>
								new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 <
								-20,
						) && Number(getComputedStyle(bar()).opacity) < 0.3,
					"展开初段底栏按钮上浮并淡出",
				);
			}
			if (changeDuringTransition) {
				await settle(reduced ? 90 : 10);
				flushSync(() => {
					store.set(hideLyricViewAtom, true);
					store.set(
						verticalCoverLayoutAtom,
						VerticalCoverLayout.ForceImmersive,
					);
					store.set(musicPlayingAtom, false);
				});
			}
			// A layout change starts the library's separate cover spring. The sheet
			// finishes first; the cover can briefly correct its moving destination.
			await settle(changeDuringTransition ? 1200 : 650);
			nativeCover.hidePopover = hidePopover;
			nativeInfo.hidePopover = hideInfo;
			if (!reduced && !changeDuringTransition) {
				check(
					motionSamples > 5 && pathError < 1,
					`展开文字始终位于起终点线段（偏差 ${pathError.toFixed(2)}px）`,
				);
				check(
					openDuration >= 480 && openDuration < 625,
					`恢复500ms过渡（实测 ${openDuration.toFixed(0)}ms）`,
				);
			}
			check(
				document.querySelectorAll("#amll-full-info").length === 1,
				"全屏歌曲信息仅暴露当前布局的锚点",
			);
			if (!reduced)
				check(
					!!infoHandoff && near(infoHandoff.before, infoHandoff.after),
					`歌曲信息交接时几何连续${infoHandoff && !near(infoHandoff.before, infoHandoff.after) ? JSON.stringify(infoHandoff) : ""}`,
				);
			check(
				cover() === nativeCover && !nativeCover.hasAttribute("popover"),
				"展开后原封面原位恢复",
			);
			check(page().dataset.phase === "open", "展开终态完成");
			if (!reduced)
				check(
					!!textHandoff && textHandoff.before === textHandoff.after,
					`展开交接前后文字样式和分隔不跳变${textHandoff && textHandoff.before !== textHandoff.after ? JSON.stringify(textHandoff) : ""}`,
				);
			const fullSheet = sheet().getBoundingClientRect();
			check(
				Math.abs(fullSheet.top) < 1 &&
					Math.abs(fullSheet.bottom - innerHeight) < 1,
				"焦点移动后卡片仍覆盖整个视口",
			);
			if (!reduced)
				check(
					!!handoff && near(handoff.before, handoff.after),
					`真实封面恢复原位时几何连续${handoff && !near(handoff.before, handoff.after) ? JSON.stringify(handoff) : ""}`,
				);
			if (nativeVideo)
				check(
					nativeCover.querySelector("video") === nativeVideo &&
						nativeVideo.readyState >= 2 &&
						!nativeVideo.paused,
					"视频节点与播放状态跨过渡保留",
				);
			check(
				document.activeElement?.getAttribute("aria-label") === "收起播放页",
				"布局就绪后聚焦收起按钮",
			);
			check(button().closest("[inert]") !== null, "展开时底栏不可聚焦或点击");
			const endRect = nativeCover.getBoundingClientRect();
			path = {
				start: fullInfo().getBoundingClientRect(),
				end: sourceInfoRect,
				linear: false,
			};
			if (nativeVideo && !reduced) {
				// Hold only the media-ready boundary so resize during handoff is deterministic.
				const thumbnail = button().querySelector("video")!;
				const descriptor = Object.getOwnPropertyDescriptor(
					thumbnail,
					"seeking",
				);
				Object.defineProperty(thumbnail, "seeking", {
					configurable: true,
					get: () => true,
				});
				releaseVideoWait = () => {
					if (descriptor)
						Object.defineProperty(thumbnail, "seeking", descriptor);
					else Reflect.deleteProperty(thumbnail, "seeking");
					thumbnail.dispatchEvent(new Event("seeked"));
				};
			}
			pathError = 0;
			motionSamples = 0;
			lastPoint = undefined;
			const closedAt = performance.now();
			nativeInfo.hidePopover = () => {
				closeDuration = performance.now() - closedAt;
				const before = textAppearance(nativeInfo);
				hideInfo.call(nativeInfo);
				queueMicrotask(() => {
					textHandoff = { before, after: textAppearance(nativeInfo) };
				});
			};
			flushSync(() =>
				document
					.querySelector<HTMLButtonElement>("[aria-label='收起播放页']")!
					.click(),
			);
			if (!reduced)
				check(
					near(nativeCover.getBoundingClientRect(), endRect),
					"收起从当前全屏位置开始",
				);
			if (!reduced) {
				await settle(80);
				const returningInfo = info().getBoundingClientRect();
				check(
					textAppearance(info(), false) === textAppearance(fullInfo(), false),
					"收起途中字重字距等外观与歌手分隔保持全屏样式",
				);
				const deltaX = path.end.left - path.start.left;
				const deltaY = path.end.top - path.start.top;
				const horizontalProgress =
					(returningInfo.left - path.start.left) / deltaX;
				const verticalProgress = (returningInfo.top - path.start.top) / deltaY;
				const sheetProgress =
					(sheet().getBoundingClientRect().top - fullSheet.top) /
					(closedSheet.top - fullSheet.top);
				check(
					Math.abs(deltaX) < 20 ||
						Math.abs(deltaY) < 20 ||
						(verticalProgress > horizontalProgress + 0.15 &&
							horizontalProgress > 0 &&
							horizontalProgress < sheetProgress),
					"收起纵向先行，横向比卡片更缓地回位",
				);
				await settle(80);
				check(
					Number(getComputedStyle(bar()).opacity) < 0.01,
					"收起前段底栏控件保持隐藏",
				);
				await settle(160);
				const tailStartLeft = info().getBoundingClientRect().left;
				await settle(80);
				check(
					Number(getComputedStyle(bar()).opacity) > 0.25 &&
						[
							...bar().querySelectorAll<HTMLElement>("[data-player-reveal]"),
						].every(
							(node) =>
								new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 >
								-20,
						),
					"收起后段底栏按钮下拉显现",
				);
				const tailEndLeft = info().getBoundingClientRect().left;
				check(
					Math.abs(deltaX) < 20 ||
						(Math.sign(deltaX) * (tailEndLeft - tailStartLeft) >
							Math.abs(deltaX) * 0.02 &&
							Math.abs(tailEndLeft - path.end.left) > Math.abs(deltaX) * 0.01),
					"收起400ms时横向仍在移动，没有提前停住",
				);
			}
			await settle();
			nativeInfo.hidePopover = hideInfo;
			if (releaseVideoWait) {
				const waiting = nativeCover.matches(":popover-open");
				window.dispatchEvent(new Event("resize"));
				const textClean = !info().style.left && !info().style.fontSize;
				releaseVideoWait();
				releaseVideoWait = undefined;
				check(waiting && textClean, "视频交接等待中 resize 不恢复文字临时样式");
			}
			if (!reduced) {
				check(
					motionSamples > 5 && pathError < 1,
					`收起双轴单调回位，没有越界或绕行（误差 ${pathError.toFixed(2)}px）`,
				);
				check(
					closeDuration >= 480 && closeDuration < 625,
					`收起文字与卡片在500ms终点交接（实测 ${Math.round(closeDuration)}ms）`,
				);
			}
			path = undefined;
			check(
				textAppearance(info(), false) === textAppearance(fullInfo(), false) &&
					getComputedStyle(info()).fontSize === "16px" &&
					(reduced ||
						(!!textHandoff && textHandoff.before === textHandoff.after)),
				"收起交接前后文字样式和分隔不跳变",
			);
			check(
				page().dataset.phase === "closed" && page().inert,
				"收起终态与交互一致",
			);
			check(document.activeElement === button(), "收起后焦点回到底栏入口");
			check(
				document.querySelectorAll(":popover-open").length === 0,
				"无残留顶层封面",
			);
			check(
				sheet().getAnimations().length === 0 &&
					info().getAnimations().length === 0,
				"交接后清理卡片与文字的浏览器动画",
			);
			setOpen(true);
			await settle(90);
			const beforeReverse = cover().getBoundingClientRect();
			const infoBeforeReverse = info().getBoundingClientRect();
			const fontBeforeReverse = getComputedStyle(info()).fontSize;
			setOpen(false);
			if (!reduced)
				check(
					near(cover().getBoundingClientRect(), beforeReverse),
					"中途反向保持当前位置",
				);
			if (!reduced)
				check(
					near(info().getBoundingClientRect(), infoBeforeReverse),
					"歌曲信息中途反向不跳位",
				);
			if (!reduced)
				check(
					getComputedStyle(info()).fontSize === fontBeforeReverse,
					"歌曲信息中途反向保留当前字号",
				);
			await settle(60);
			const beforeReopen = cover().getBoundingClientRect();
			const fontBeforeReopen = getComputedStyle(info()).fontSize;
			setOpen(true);
			if (!reduced)
				check(
					near(cover().getBoundingClientRect(), beforeReopen),
					"再次反向保持当前位置",
				);
			if (!reduced)
				check(
					getComputedStyle(info()).fontSize === fontBeforeReopen,
					"再次反向保持当前字号",
				);
			if (!nativeVideo) flushSync(() => store.set(musicCoverAtom, covers[1]));
			await settle();
			check(
				cover() === nativeCover && page().dataset.phase === "open",
				nativeVideo ? "反向过渡保留呈现节点" : "过渡中换封面不重建呈现节点",
			);
			setOpen(false);
			await settle();
			check(
				!nativeCover.hasAttribute("style") || !nativeCover.style.left,
				"清理临时几何样式",
			);
			check(
				!info().hasAttribute("popover") &&
					!info().style.left &&
					!info().style.fontSize &&
					!info().style.lineHeight &&
					!fullInfo().style.visibility,
				"清理文字浮层和全屏信息隐藏状态",
			);
			check(
				textAppearance(info(), false) === textAppearance(fullInfo(), false) &&
					getComputedStyle(info()).fontSize === "16px",
				"中途反向后文字仍与全屏统一",
			);
			if (nativeVideo)
				check(
					nativeCover.querySelector("video") === nativeVideo,
					"收起后仍使用同一个视频节点",
				);
			if (nativeVideo) {
				const thumbnail = button().querySelector("video")!;
				check(
					nativeVideo.paused &&
						thumbnail.paused &&
						!thumbnail.seeking &&
						Math.abs(nativeVideo.currentTime - thumbnail.currentTime) < 0.001,
					"收起交接后两处视频帧时间一致",
				);
			}
			const playing = store.get(musicPlayingAtom);
			document.getElementById("outside-content-button")!.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: " ",
					bubbles: true,
					cancelable: true,
				}),
			);
			check(
				store.get(musicPlayingAtom) === playing,
				"页面外空格不触发播放页快捷键",
			);
			setOpen(true);
			await settle();
			const collapse = document.querySelector<HTMLButtonElement>(
				"[aria-label='收起播放页']",
			)!;
			flushSync(() =>
				collapse.dispatchEvent(
					new KeyboardEvent("keydown", {
						key: " ",
						bubbles: true,
						cancelable: true,
					}),
				),
			);
			check(
				store.get(musicPlayingAtom) === playing,
				"按钮空格保留原生行为且不重复播放",
			);
			flushSync(() =>
				page().dispatchEvent(
					new KeyboardEvent("keydown", {
						key: " ",
						bubbles: true,
						cancelable: true,
					}),
				),
			);
			check(store.get(musicPlayingAtom) !== playing, "播放页空格调用播放回调");
			flushSync(() =>
				page().dispatchEvent(
					new KeyboardEvent("keydown", {
						key: " ",
						repeat: true,
						bubbles: true,
						cancelable: true,
					}),
				),
			);
			check(store.get(musicPlayingAtom) !== playing, "长按空格不重复切换");
			flushSync(() =>
				page().dispatchEvent(
					new KeyboardEvent("keydown", {
						key: "Escape",
						bubbles: true,
						cancelable: true,
					}),
				),
			);
			await settle();
			check(
				page().inert && document.activeElement === button(),
				"Escape 收起并恢复焦点",
			);
			store.set(musicPlayingAtom, playing);
			setResult(
				JSON.stringify(
					{
						passed: checks.length,
						reducedMotion: reduced,
						video: !!nativeVideo,
						viewport: [innerWidth, innerHeight],
						checks,
					},
					null,
					2,
				),
			);
		} catch (error) {
			setResult(JSON.stringify({ failed: String(error), checks }, null, 2));
		} finally {
			releaseVideoWait?.();
		}
	};
	return (
		<aside
			style={{
				position: "fixed",
				right: 12,
				top: 12,
				zIndex: 10000,
				display: "flex",
				gap: 8,
				flexWrap: "wrap",
				maxWidth: "40vw",
			}}
		>
			<button type="button" onClick={run}>
				运行检查
			</button>
			<button
				type="button"
				onClick={async () => {
					const url = videoUrl || (await makeVideo());
					setVideoUrl(url);
					store.set(musicCoverAtom, url);
					store.set(musicCoverIsVideoAtom, true);
				}}
			>
				视频封面
			</button>
			<button
				type="button"
				onClick={() => {
					store.set(hideLyricViewAtom, true);
					store.set(
						verticalCoverLayoutAtom,
						VerticalCoverLayout.ForceImmersive,
					);
					store.set(musicPlayingAtom, false);
				}}
			>
				暂停沉浸布局
			</button>
			<button
				type="button"
				onClick={() => setChangeDuringTransition(!changeDuringTransition)}
			>
				中途变更{changeDuringTransition ? "：开" : "：关"}
			</button>
			<button
				type="button"
				onClick={() =>
					store.set(isLyricPageOpenedAtom, !store.get(isLyricPageOpenedAtom))
				}
			>
				切换
			</button>
			<button
				type="button"
				onClick={() =>
					store.set(
						musicCoverAtom,
						store.get(musicCoverAtom) === covers[0] ? covers[1] : covers[0],
					)
				}
			>
				换封面
			</button>
			<button
				type="button"
				onClick={() =>
					store.set(hideLyricViewAtom, !store.get(hideLyricViewAtom))
				}
			>
				切换歌词布局
			</button>
			<button
				type="button"
				onClick={() => {
					store.set(
						musicNameAtom,
						"沿着夜色走过漫长街道 — A Long Song Title for the Straight Transition",
					);
					store.set(musicArtistsAtom, [
						{ name: "Transition Study", id: "test" },
						{ name: "Night Ensemble", id: "test-2" },
					]);
				}}
			>
				长歌曲信息
			</button>
			<button
				type="button"
				onClick={() => {
					store.set(musicNameAtom, "创世烟火");
					store.set(musicArtistsAtom, [
						{ name: "哔栗", id: "artist-1" },
						{ name: "鸣米", id: "artist-2" },
						{ name: "第三位歌手", id: "artist-3" },
					]);
					store.set(lyricFontFamilyAtom, "Georgia, serif");
				}}
			>
				多人及自定义字体
			</button>
			<pre
				data-testid="results"
				style={{
					position: "fixed",
					right: 12,
					bottom: 20,
					maxWidth: "min(480px, 40vw)",
					maxHeight: "35vh",
					overflow: "auto",
					background: "#111d",
					fontSize: 11,
					whiteSpace: "pre-wrap",
				}}
			>
				{result}
			</pre>
		</aside>
	);
}

const root = createRoot(document.getElementById("root")!);
import.meta.hot?.dispose(() => root.unmount());
root.render(
	<StrictMode>
		<Provider store={store}>
			<Theme appearance="dark">
				<PlaybackTransition>
					<Surface />
				</PlaybackTransition>
				<TestControls />
			</Theme>
		</Provider>
	</StrictMode>,
);
