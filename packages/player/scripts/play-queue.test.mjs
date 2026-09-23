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

for (const shuffle of [false, true]) {
	test(`play next moves an earlier queued item without restarting, shuffle=${shuffle}`, (t) => {
		t.mock.method(Math, "random", () => 0);
		const queue = new PlayQueueManager(createStore());
		if (shuffle) queue.toggleShuffleOn();
		queue.setQueue(songs);
		queue.playAt(2);
		const current = queue.getCurrentSong();
		const earlier = queue.getPlayList()[0];
		audio.mock.resetCalls();

		queue.enqueueNext({ ...earlier, filePath: "stale.flac" });
		assert.equal(queue.getCurrentSong(), current);
		assert.equal(queue.getCurrentIndex(), 1);
		assert.equal(queue.getPlayList()[2], earlier);
		assert.equal(queue.getPlayList().length, songs.length);
		assert.deepEqual(audio.mock.calls, []);
		queue.advanceForAutoEnd();
		assert.deepEqual(playRequests(), [earlier.id]);
	});

	test(`new songs enter the next position and actual tail, shuffle=${shuffle}`, () => {
		const store = createStore();
		const queue = new PlayQueueManager(store);
		if (shuffle) queue.toggleShuffleOn();
		queue.setQueue(songs, 42, 1);
		const current = queue.getCurrentSong();
		const next = { id: "next", filePath: "next.flac" };
		const tail = { id: "tail", filePath: "tail.flac" };
		audio.mock.resetCalls();

		queue.enqueueNext(next);
		queue.enqueueTail(tail);
		assert.equal(queue.getCurrentSong(), current);
		assert.equal(queue.getPlayList()[queue.getCurrentIndex() + 1], next);
		assert.equal(queue.getPlayList().at(-1), tail);
		assert.deepEqual(store.get(persistedQueueStateAtom).originalSongIds, [
			"a",
			"b",
			"c",
			"d",
			"next",
			"tail",
		]);
		assert.deepEqual(audio.mock.calls, []);
		if (shuffle) {
			queue.toggleShuffleOff();
			assert.deepEqual(queue.getPlayList(), [...songs, next, tail]);
			assert.equal(queue.getCurrentSong(), current);
			assert.deepEqual(playRequests(), []);
		}
	});

	test(`current song and repeated enqueues do not duplicate or restart, shuffle=${shuffle}`, () => {
		const queue = new PlayQueueManager(createStore());
		if (shuffle) queue.toggleShuffleOn();
		queue.setQueue(songs, 42, 1);
		const before = queue.getPlayList();
		const current = queue.getCurrentSong();
		audio.mock.resetCalls();

		queue.enqueueNext(current);
		queue.enqueueTail(current);
		queue.enqueueTail(songs[2]);
		assert.deepEqual(queue.getPlayList(), before);
		queue.enqueueNext(songs[2]);
		queue.enqueueNext(songs[2]);
		assert.equal(queue.getPlayList().length, songs.length);
		assert.equal(queue.getPlayList()[queue.getCurrentIndex() + 1], songs[2]);
		assert.equal(queue.getCurrentSong(), current);
		assert.deepEqual(audio.mock.calls, []);
	});

	for (const method of ["enqueueNext", "enqueueTail"]) {
		test(`${method} on an empty queue starts the selected song once, shuffle=${shuffle}`, () => {
			const queue = new PlayQueueManager(createStore());
			if (shuffle) queue.toggleShuffleOn();
			queue[method](songs[2]);
			assert.deepEqual(queue.getPlayList(), [songs[2]]);
			assert.equal(queue.getCurrentSong(), songs[2]);
			assert.equal(queue.getCurrentIndex(), 0);
			assert.equal(queue.isShuffleActive(), shuffle);
			assert.deepEqual(playRequests(), ["c"]);
		});
	}
}
