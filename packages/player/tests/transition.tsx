import "../src/styles.css";
import {
	cssBackgroundPropertyAtom,
	hideLyricViewAtom,
	isLyricPageOpenedAtom,
	lyricBackgroundRendererAtom,
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
		const settle = (ms = 850) =>
			new Promise<void>((resolve) => {
				const start = performance.now();
				const frame = () =>
					performance.now() - start >= ms
						? resolve()
						: requestAnimationFrame(frame);
				requestAnimationFrame(frame);
			});
		const setOpen = (opened: boolean) =>
			flushSync(() => store.set(isLyricPageOpenedAtom, opened));
		const near = (a: DOMRect, b: DOMRect) =>
			["left", "top", "width", "height"].every(
				(key) => Math.abs(a[key as "left"] - b[key as "left"]) < 1,
			);
		const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
		try {
			setResult("运行中");
			setOpen(false);
			await settle();
			check(page().inert, "关闭页面不可交互");
			const nativeCover = cover();
			const nativeVideo = nativeCover.querySelector("video");
			button().focus();
			const sourceRect = button().getBoundingClientRect();
			const metadata = bar().querySelector<HTMLElement>(
				"[data-player-reveal='metadata']",
			)!;
			const metadataRect = metadata.getBoundingClientRect();
			const backdrop = document
				.getElementById("outside-content-button")!
				.closest("main")!.parentElement!;
			const backdropRect = backdrop.getBoundingClientRect();
			const closedSheet = sheet().getBoundingClientRect();
			flushSync(() => button().click());
			check(page().contains(document.activeElement), "展开后焦点进入播放页");
			if (!reduced) {
				check(nativeCover.matches(":popover-open"), "真实封面进入顶层");
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
			const hidePopover = nativeCover.hidePopover;
			nativeCover.hidePopover = () => {
				const before = nativeCover.getBoundingClientRect();
				hidePopover.call(nativeCover);
				queueMicrotask(() => {
					handoff = { before, after: nativeCover.getBoundingClientRect() };
				});
			};
			if (!reduced) {
				await settle(120);
				const movingSheet = sheet().getBoundingClientRect();
				const movingCover = nativeCover.getBoundingClientRect();
				check(
					Math.abs(backdrop.getBoundingClientRect().top - backdropRect.top) <
						1 && backdrop.getBoundingClientRect().height < backdropRect.height,
					"背景以顶部为锚点缩小",
				);
				check(
					Math.abs(metadata.getBoundingClientRect().left - metadataRect.left) <
						1 &&
						metadata.getBoundingClientRect().top < metadataRect.top &&
						!metadata.matches(":popover-open"),
					"歌曲信息仅竖直平移淡出，无绕行浮层",
				);
				check(
					(closedSheet.top - movingSheet.top) / closedSheet.top < 0.55,
					"展开起步缓和，前120ms未越过大半行程",
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
					"展开初段可见文字和控件上浮并淡出",
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
			await settle();
			nativeCover.hidePopover = hidePopover;
			check(
				cover() === nativeCover && !nativeCover.hasAttribute("popover"),
				"展开后原封面原位恢复",
			);
			check(page().dataset.phase === "open", "展开终态完成");
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
				await settle(220);
				check(
					Number(getComputedStyle(bar()).opacity) < 0.01,
					"收起前段底栏控件保持隐藏",
				);
				await settle(340);
				check(
					page().dataset.phase === "moving",
					"560ms时仍平滑收起，未提前结束",
				);
				check(
					Number(getComputedStyle(bar()).opacity) > 0.25 &&
						[
							...bar().querySelectorAll<HTMLElement>("[data-player-reveal]"),
						].every(
							(node) =>
								new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 >
								-20,
						),
					"收起后段底栏文字和按钮下拉显现",
				);
			}
			await settle();
			check(
				page().dataset.phase === "closed" && page().inert,
				"收起终态与交互一致",
			);
			check(document.activeElement === button(), "收起后焦点回到底栏入口");
			check(
				document.querySelectorAll(":popover-open").length === 0,
				"无残留顶层封面",
			);
			setOpen(true);
			await settle(90);
			const beforeReverse = cover().getBoundingClientRect();
			setOpen(false);
			if (!reduced)
				check(
					near(cover().getBoundingClientRect(), beforeReverse),
					"中途反向保持当前位置",
				);
			await settle(60);
			const beforeReopen = cover().getBoundingClientRect();
			setOpen(true);
			if (!reduced)
				check(
					near(cover().getBoundingClientRect(), beforeReopen),
					"再次反向保持当前位置",
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
