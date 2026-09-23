import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { atom, createStore } from "jotai";

const audio = mock.fn();
mock.module("@applemusic-like-lyrics/react-full", {
	exports: {
		isShuffleActiveAtom: atom(false),
		musicPlayingPositionAtom: atom(0),
		RepeatMode: { Off: "off", All: "all", One: "one" },
		repeatModeAtom: atom("off"),
	},
});
mock.module("../src/utils/player.ts", {
	exports: { emitAudioThread: audio },
});
mock.module("../src/utils/db-client.ts", { exports: { db: {} } });

const { PlayQueueManager, persistedQueueStateAtom } = await import(
	"../src/utils/play-queue-manager.ts"
);
const songs = ["a", "b", "c", "d"].map((id) => ({
	id,
	filePath: `${id}.flac`,
}));
const playRequests = () =>
	audio.mock.calls
		.filter((call) => call.arguments[0] === "playAudio")
		.map((call) => call.arguments[1].song.songId);

beforeEach(() => audio.mock.resetCalls());

for (const shuffle of [false, true]) {
	for (const startIndex of [0, 1, 3]) {
		test(`playlist starts at ${startIndex}, shuffle=${shuffle}`, (t) => {
			t.mock.method(Math, "random", () => 0);
			const store = createStore();
			const queue = new PlayQueueManager(store);
			if (shuffle) queue.toggleShuffleOn();
			queue.setQueue(songs, 42, startIndex);

			assert.deepEqual(playRequests(), [songs[startIndex].id]);
			assert.equal(queue.getCurrentSong(), songs[startIndex]);
			assert.equal(queue.isShuffleActive(), shuffle);
			assert.equal(queue.getPlaylistId(), 42);
			assert.deepEqual(
				store.get(persistedQueueStateAtom).originalSongIds,
				songs.map((song) => song.id),
			);
			if (shuffle) {
				assert.equal(queue.getCurrentIndex(), 0);
				assert.deepEqual(
					queue
						.getPlayList()
						.map((song) => song.id)
						.sort(),
					songs.map((song) => song.id),
				);
			} else {
				assert.equal(queue.getCurrentIndex(), startIndex);
				assert.deepEqual(queue.getPlayList(), songs);
			}
		});
	}
}

test("shuffle without a selected index still chooses a shuffled first song", (t) => {
	t.mock.method(Math, "random", () => 0);
	const queue = new PlayQueueManager(createStore());
	queue.toggleShuffleOn();
	queue.setQueue(songs);
	assert.deepEqual(playRequests(), ["b"]);
	assert.deepEqual(
		queue.getPlayList().map((song) => song.id),
		["b", "c", "d", "a"],
	);
});
