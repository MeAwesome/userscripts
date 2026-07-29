// ==UserScript==
// @name         Hide YouTube Comments on Music
// @description  Hides comments on songs/music videos and adds a button to reveal them.
// @icon         https://icons.duckduckgo.com/ip3/youtube.com.ico
// @version      1.0
// @author       MeAwesome
// @namespace    https://github.com/MeAwesome/userscripts
// @supportURL   https://github.com/MeAwesome/userscripts/issues
// @license      Apache-2.0
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const STYLE_ID = "hide-music-comments-style";
  const MUSIC_ATTRIBUTE = "data-music-video";
  const COMMENTS_SHOWN_ATTRIBUTE = "data-music-comments-shown";
  const BUTTON_CONTAINER_ID = "music-comments-button-container";

  let navigationNumber = 0;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
            html[${MUSIC_ATTRIBUTE}="true"]:not([${COMMENTS_SHOWN_ATTRIBUTE}="true"])
                ytd-comments#comments,
            html[${MUSIC_ATTRIBUTE}="true"]:not([${COMMENTS_SHOWN_ATTRIBUTE}="true"])
                #comments {
                display: none !important;
            }

            #${BUTTON_CONTAINER_ID} {
                display: none;
                margin: 16px 0;
            }

            html[${MUSIC_ATTRIBUTE}="true"]:not([${COMMENTS_SHOWN_ATTRIBUTE}="true"])
                #${BUTTON_CONTAINER_ID} {
                display: block;
            }

            #${BUTTON_CONTAINER_ID} button {
    width: 100%;
    padding: 12px 16px;
    border: none;
    border-radius: 18px;
    background: var(--yt-spec-static-brand-white, #ffffff);
    color: var(--yt-spec-static-brand-black, #0f0f0f);
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}

#${BUTTON_CONTAINER_ID} button:hover {
    background: #e5e5e5;
}
        `;

    (document.head || document.documentElement).appendChild(style);
  }

  function getCurrentVideoId() {
    if (location.pathname !== "/watch") {
      return null;
    }

    return new URL(location.href).searchParams.get("v");
  }

  function getPlayerResponse() {
    const watchPage = document.querySelector("ytd-watch-flexy");

    const possibleResponses = [
      watchPage?.playerData,
      watchPage?.data?.playerResponse,
      watchPage?.data?.playerData,
      window.ytInitialPlayerResponse,
    ];

    for (const response of possibleResponses) {
      if (response?.videoDetails?.videoId) {
        return response;
      }
    }

    return null;
  }

  function getVideoCategory(playerResponse) {
    return (
      playerResponse?.microformat?.playerMicroformatRenderer?.category ?? null
    );
  }

  function removeButton() {
    document.getElementById(BUTTON_CONTAINER_ID)?.remove();
  }

  function createButton() {
    if (document.getElementById(BUTTON_CONTAINER_ID)) {
      return true;
    }

    const comments = document.querySelector(
      "ytd-watch-flexy ytd-comments#comments",
    );

    if (!comments?.parentElement) {
      return false;
    }

    const container = document.createElement("div");
    container.id = BUTTON_CONTAINER_ID;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Show comments";

    button.addEventListener("click", () => {
      document.documentElement.setAttribute(COMMENTS_SHOWN_ATTRIBUTE, "true");

      container.remove();

      // Encourage YouTube to load comments if they were not loaded yet.
      document
        .querySelector("ytd-comments#comments")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    container.appendChild(button);
    comments.parentElement.insertBefore(container, comments);

    return true;
  }

  function resetPageState() {
    document.documentElement.removeAttribute(MUSIC_ATTRIBUTE);
    document.documentElement.removeAttribute(COMMENTS_SHOWN_ATTRIBUTE);
    removeButton();
  }

  function showCommentsNormally() {
    document.documentElement.removeAttribute(MUSIC_ATTRIBUTE);
    document.documentElement.removeAttribute(COMMENTS_SHOWN_ATTRIBUTE);
    removeButton();
  }

  function hideComments() {
    document.documentElement.setAttribute(MUSIC_ATTRIBUTE, "true");
    document.documentElement.removeAttribute(COMMENTS_SHOWN_ATTRIBUTE);
    createButton();
  }

  async function updateForCurrentVideo() {
    const thisNavigation = ++navigationNumber;
    const expectedVideoId = getCurrentVideoId();

    resetPageState();

    if (!expectedVideoId) {
      return;
    }

    // Wait for YouTube's player data to match the current URL.
    for (let attempt = 0; attempt < 100; attempt++) {
      if (thisNavigation !== navigationNumber) {
        return;
      }

      const playerResponse = getPlayerResponse();
      const loadedVideoId = playerResponse?.videoDetails?.videoId;

      if (loadedVideoId === expectedVideoId) {
        const category = getVideoCategory(playerResponse);
        const isMusic = category?.toLowerCase() === "music";

        console.log("[Music comments]", {
          expectedVideoId,
          loadedVideoId,
          category,
          isMusic,
        });

        if (isMusic) {
          hideComments();

          // Comments may be inserted after the player data loads.
          for (let buttonAttempt = 0; buttonAttempt < 100; buttonAttempt++) {
            if (thisNavigation !== navigationNumber) {
              return;
            }

            if (createButton()) {
              break;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } else {
          showCommentsNormally();
        }

        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.warn(
      "[Music comments] Could not obtain current player data:",
      expectedVideoId,
    );
  }

  installStyle();

  document.addEventListener(
    "yt-navigate-start",
    () => {
      navigationNumber++;
      resetPageState();
    },
    true,
  );

  document.addEventListener("yt-navigate-finish", updateForCurrentVideo, true);

  document.addEventListener(
    "yt-page-data-updated",
    updateForCurrentVideo,
    true,
  );

  document.addEventListener("yt-update-title", updateForCurrentVideo, true);

  window.addEventListener("popstate", updateForCurrentVideo);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateForCurrentVideo, {
      once: true,
    });
  } else {
    updateForCurrentVideo();
  }
})();
