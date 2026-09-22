export type InfoPose = {
	left: number;
	top: number;
	width: number;
	height: number;
	fontSize: number;
	lineHeight: number;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Move the existing compact text; its slot and the full text keep their layout. */
export function createInfoMotion(
	source: HTMLDivElement,
	slot: HTMLDivElement,
	destination: HTMLDivElement,
	page: HTMLDivElement,
	opening: boolean,
	previous: InfoPose | null,
) {
	const measure = (node: HTMLElement, full: boolean): InfoPose => {
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
	const compact = () => measure(slot, false);
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
	let start = previous ?? (opening ? compact() : full());
	let current = start;
	const visibility = destination.style.visibility;
	destination.style.visibility = "hidden";
	source.setAttribute("popover", "manual");
	source.showPopover();

	return {
		paint(fraction: number, progress: number) {
			const target = opening ? full() : compact();
			current = {
				left: mix(start.left, target.left, fraction),
				top: mix(start.top, target.top, fraction),
				width: mix(start.width, target.width, fraction),
				height: mix(start.height, target.height, fraction),
				fontSize: mix(start.fontSize, target.fontSize, fraction),
				lineHeight: mix(start.lineHeight, target.lineHeight, fraction),
			};
			Object.assign(source.style, {
				left: `${current.left}px`,
				top: `${current.top}px`,
				width: `${current.width}px`,
				height: `${current.height}px`,
				fontSize: `${current.fontSize}px`,
				lineHeight: `${current.lineHeight}px`,
			});
			source.style.setProperty(
				"--player-info-name-weight",
				`${mix(400, nameWeight, progress)}`,
			);
			source.style.setProperty(
				"--player-info-name-opacity",
				`${mix(1, nameOpacity, progress)}`,
			);
			source.style.setProperty(
				"--player-info-artist-opacity",
				`${mix(1, artistOpacity, progress)}`,
			);
			source.style.setProperty(
				"--player-info-letter-spacing",
				`${mix(0, letterSpacing, progress)}px`,
			);
			return current;
		},
		rebase() {
			start = current;
		},
		restore() {
			if (source.matches(":popover-open")) source.hidePopover();
			source.removeAttribute("popover");
			for (const key of [
				"left",
				"top",
				"width",
				"height",
				"font-size",
				"line-height",
				"--player-info-name-weight",
				"--player-info-name-opacity",
				"--player-info-artist-opacity",
				"--player-info-letter-spacing",
			])
				source.style.removeProperty(key);
			destination.style.visibility = visibility;
		},
	};
}
