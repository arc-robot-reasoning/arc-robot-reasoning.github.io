# ARC paper website

An anonymous, self-contained academic website for **ARC: A Reasoning Recipe for Robot Foundation Models**.

## Preview

From this directory, run:

```sh
npm start
```

Open **http://127.0.0.1:4173**. No package installation or build step is required. Node.js 18 or newer is sufficient. Use an HTTP server rather than opening `index.html` directly: the tables and video gallery load local JSON files.

## Publish

Upload the contents of this directory to a static web host. All asset URLs are relative, so the website also works in a subdirectory. The `tools/` directory and `package.json` are only needed for local preview. No analytics, third-party fonts, or external JavaScript are used.

The canonical site URL and social preview image are configured for `https://arc-robot-reasoning.github.io/`.

## Content

- `index.html`: page sections and scientific narrative.
- `styles.css`: Inter typography, ARC blue, responsive layouts.
- `app.js`: benchmark tables, architecture tabs, and figure enlargement.
- `players.js`: synchronized comparisons and time-aligned traces inside each ARC card.
- `assets/data/results.json`: paper results and reported uncertainties.
- `assets/data/videos.json`: seven tasks and seventeen video assets.
- `assets/data/traces.json`: dense, time-aligned seven-sentence reasoning paragraphs, with explicit authorship provenance.
- `assets/figures/`: web images and original figure PDFs.
- `assets/videos/arc-trace-droid-trailer.mp4`: rebranded dataset trailer; original footage, sample traces, scene order, and timing preserved.
- `assets/paper/arc-paper.pdf`: compiled anonymous manuscript.
- `assets/paper/`: detailed result tables and training settings.

## Video timing and explanations

The supplied clips were already accelerated by **3×**. Their timing is preserved. The shared player synchronizes elapsed video time, not normalized progress. Shorter clips remain on their final frame. The **Real time** setting plays these clips at one-third speed.

Hardware browser copies use H.264, 1440 × 810, 30 fps, and web streaming metadata. The dataset trailer remains at 1920 × 1080. HDR footage is tone-mapped to SDR for consistent browser display. Source videos remain unchanged.

The supplied assets did not include timestamped deployment reasoning logs. The included ARC text is therefore labeled **Authored trace**, based on visible events and the paper's hardware explanations. It is not presented as recorded model output. Baseline videos do not claim ARC reasoning traces. The display follows the video clock at **15 Hz**, updating each paragraph at the annotated pickup, transfer, placement, or scene-change boundary. This display rate is separate from the paper's approximately 1 Hz reasoning refresh rate.

Each authored paragraph contains exactly seven sentences in this order: **state, cause, consequence, effect, action, avoidance, and completion**. The field names are not displayed. Sentences describe the current scene, its causal relevance, a possible consequence, the intended effect, the next action, what to avoid, and current task progress.

Recorded traces can replace authored explanations using this schema:

```json
{
  "version": 1,
  "groups": {
    "discovery": {
      "provenance": "recorded",
      "segments": [
        {
          "start": 0,
          "end": 2,
          "text": "The full recorded reasoning paragraph for this interval."
        }
      ]
    }
  }
}
```

Times are seconds on the encoded video timeline. For compatibility, structured inputs may use fields including `state`, `cause`, `consequence`, `effect`, `action`, `avoid`, and `completion`. The website renders either format as a paragraph without field tags; the included annotations use fluent `text` paragraphs. Mark real logs `recorded` and explanatory annotations `authored`; the website displays the appropriate label. Missing traces remain hidden.

## Checks

```sh
npm run check
```

Desktop and mobile layouts, real-media synchronization, keyboard tabs, figure dialogs, and static asset links were checked in Chromium. The website includes local font licenses in `assets/fonts/`. Paper figures and results remain research content supplied with the manuscript.
