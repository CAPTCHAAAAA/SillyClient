(() => {
  const locks = new WeakMap();
  window.SillyClientCarouselSnap = {
    set(track, owner, locked) {
      let state = locks.get(track);
      if (locked) {
        if (!state) {
          state = { owners: new Set(), original: track.style.scrollSnapType };
          locks.set(track, state);
        }
        state.owners.add(owner);
        if (track.style.scrollSnapType !== "none") track.style.scrollSnapType = "none";
      } else if (state) {
        state.owners.delete(owner);
        if (state.owners.size === 0) {
          track.style.scrollSnapType = state.original;
          locks.delete(track);
        }
      }
    },
    has(track, owner) {
      return locks.get(track)?.owners.has(owner) === true;
    },
  };
})();
