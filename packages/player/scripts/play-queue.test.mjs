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
mock.module("../src/utils/db-client.ts", {
	exports: {
		db: {
			songs: {
				getByIds: async (ids) => songs.filter((song) => ids.includes(song.id)),
			},
		},
	},
});

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
			assert.deepEqual(queue.getCurrentSong(), songs[startIndex]);
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
	test(`play next adds another occurrence without moving existing items, shuffle=${shuffle}`, (t) => {
		t.mock.method(Math, "random", () => 0);
		const queue = new PlayQueueManager(createStore());
		if (shuffle) queue.toggleShuffleOn();
		queue.setQueue(songs);
		queue.playAt(2);
		const current = queue.getCurrentSong();
		const earlier = queue.getPlayList()[0];
		const before = queue.getPlayList();
		audio.mock.resetCalls();

		queue.enqueueNext(earlier);
		assert.equal(queue.getCurrentSong(), current);
		assert.equal(queue.getCurrentIndex(), 2);
		assert.deepEqual(queue.getPlayList(), [
			...before.slice(0, 3),
			earlier,
			...before.slice(3),
		]);
		assert.notEqual(queue.getPlayList()[3], earlier);
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
		assert.deepEqual(queue.getPlayList()[queue.getCurrentIndex() + 1], next);
		assert.deepEqual(queue.getPlayList().at(-1), tail);
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

	test(`current song and repeated enqueues each add an occurrence without restarting, shuffle=${shuffle}`, () => {
		const queue = new PlayQueueManager(createStore());
		if (shuffle) queue.toggleShuffleOn();
		queue.setQueue(songs, 42, 1);
		const index = queue.getCurrentIndex();
		const current = queue.getCurrentSong();
		audio.mock.resetCalls();

		queue.enqueueNext(current);
		queue.enqueueNext(current);
		queue.enqueueTail(current);
		queue.enqueueTail(songs[2]);
		queue.enqueueTail(songs[2]);
		assert.equal(queue.getPlayList().length, songs.length + 5);
		assert.deepEqual(queue.getPlayList().slice(index, index + 3), [
			current,
			current,
			current,
		]);
		assert.deepEqual(queue.getPlayList().slice(-3), [
			current,
			songs[2],
			songs[2],
		]);
		assert.equal(new Set(queue.getPlayList()).size, queue.getPlayList().length);
		assert.equal(queue.getCurrentSong(), current);
		assert.equal(queue.getCurrentIndex(), index);
		assert.deepEqual(audio.mock.calls, []);
		queue.advanceForAutoEnd();
		queue.advanceForAutoEnd();
		assert.equal(queue.getCurrentIndex(), index + 2);
		assert.deepEqual(playRequests(), [current.id, current.id]);
	});

	test(`shuffle and restore keep the selected duplicate occurrence, shuffle=${shuffle}`, async (t) => {
		t.mock.method(Math, "random", () => 0);
		const store = createStore();
		const queue = new PlayQueueManager(store);
		if (shuffle) queue.toggleShuffleOn();
		queue.setQueue(songs, 42, 1);
		queue.enqueueNext(songs[1]);
		queue.enqueueTail(songs[1]);
		queue.playAt(queue.getPlayList().length - 1);
		const current = queue.getCurrentSong();
		audio.mock.resetCalls();
		queue.toggleShuffleOn();
		assert.equal(queue.getCurrentSong(), current);
		const saved = JSON.parse(
			JSON.stringify(store.get(persistedQueueStateAtom)),
		);
		const restoredStore = createStore();
		restoredStore.set(persistedQueueStateAtom, saved);
		const restored = new PlayQueueManager(restoredStore);
		assert.equal((await restored.restore()).restored, true);
		assert.deepEqual(restored.getPlayList(), queue.getPlayList());
		assert.equal(restored.getCurrentIndex(), queue.getCurrentIndex());
		restored.toggleShuffleOff();
		assert.deepEqual(restored.getPlayList(), [...songs, songs[1], songs[1]]);
		assert.equal(restored.getCurrentIndex(), songs.length + 1);
		assert.deepEqual(playRequests(), []);
	});

	for (const method of ["enqueueNext", "enqueueTail"]) {
		test(`${method} on an empty queue starts the selected song once, shuffle=${shuffle}`, () => {
			const queue = new PlayQueueManager(createStore());
			if (shuffle) queue.toggleShuffleOn();
			queue[method](songs[2]);
			assert.deepEqual(queue.getPlayList(), [songs[2]]);
			assert.deepEqual(queue.getCurrentSong(), songs[2]);
			assert.equal(queue.getCurrentIndex(), 0);
			assert.equal(queue.isShuffleActive(), shuffle);
			assert.deepEqual(playRequests(), ["c"]);
		});
	}
}

test("duplicate entries supplied to setQueue remain distinct across shuffle", () => {
	const queue = new PlayQueueManager(createStore());
	queue.setQueue([songs[0], songs[0], songs[1]], 42, 1);
	const current = queue.getCurrentSong();
	queue.toggleShuffleOn();
	assert.equal(queue.getCurrentSong(), current);
	queue.toggleShuffleOff();
	assert.equal(queue.getCurrentIndex(), 1);
});

test("removing one occurrence leaves the others in both playback orders", () => {
	const queue = new PlayQueueManager(createStore());
	queue.setQueue([songs[0], songs[1], songs[0], songs[2]], 42, 1);
	const current = queue.getCurrentSong();
	audio.mock.resetCalls();
	queue.removeSong(songs[0].id);
	queue.toggleShuffleOn();
	queue.toggleShuffleOff();
	assert.deepEqual(queue.getPlayList(), [songs[1], songs[0], songs[2]]);
	assert.equal(queue.getCurrentSong(), current);
	assert.equal(queue.getCurrentIndex(), 0);
	assert.deepEqual(playRequests(), []);
});

test("saved queues without occurrence positions still restore", async () => {
	const store = createStore();
	store.set(persistedQueueStateAtom, {
		songIds: ["c", "a", "b"],
		originalSongIds: ["a", "b", "c"],
		currentIndex: 0,
		repeatMode: "off",
		shuffleActive: true,
		playlistId: 42,
		position: 12,
	});
	const queue = new PlayQueueManager(store);
	assert.deepEqual(await queue.restore(), { restored: true, position: 12 });
	queue.toggleShuffleOff();
	assert.deepEqual(queue.getPlayList(), songs.slice(0, 3));
	assert.equal(queue.getCurrentIndex(), 2);
	assert.deepEqual(playRequests(), []);
});

test("legacy duplicates restore as distinct occurrences and keep their selected position", async () => {
	const store = createStore();
	store.set(persistedQueueStateAtom, {
		songIds: ["b", "a", "a"],
		originalSongIds: ["a", "a", "b"],
		currentIndex: 2,
		repeatMode: "off",
		shuffleActive: true,
		playlistId: 42,
		position: 12,
	});
	const queue = new PlayQueueManager(store);
	assert.equal((await queue.restore()).restored, true);
	assert.equal(new Set(queue.getPlayList()).size, 3);
	assert.deepEqual(store.get(persistedQueueStateAtom).playOrder, [2, 0, 1]);
	queue.toggleShuffleOff();
	assert.deepEqual(queue.getPlayList(), [songs[0], songs[0], songs[1]]);
	assert.equal(queue.getCurrentIndex(), 1);
	queue.removeSong("a");
	assert.deepEqual(queue.getPlayList(), [songs[0], songs[1]]);
	assert.equal(queue.getCurrentIndex(), 0);
	assert.deepEqual(store.get(persistedQueueStateAtom).playOrder, [0, 1]);
	assert.deepEqual(playRequests(), []);
});
