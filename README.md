# happyseaurchin.github.io

David Pinto's own pages, drawn live from [the beach](https://beach.happyseaurchin.com). Every word you
read here comes from the beach as the page loads; the HTML holds only labels. It is David's own space:
his code, his blocks, his names.

| page | what it draws |
|---|---|
| `index.html` | who David is (`passport:happyseaurchin`), today's line on the clock and the rungs above it (`now:happyseaurchin`), and the places he keeps (`lists:happyseaurchin` 2) as doors into happyseaurchin.com |
| `map.html` | everything named `*:happyseaurchin` on the beach, grouped, with the projects and places he lists and the rooms his shell names — derived from the beach's index on every load, never kept by hand |
| `projects.html` | `lists:happyseaurchin` 1 in order, each with its form, its counts, and its two ways in |
| `diary.html` | `spine:happyseaurchin`, newest post first, with readers' notebooks beside each post |
| `f.html?family=<name>` | any family on the beach, drawn by its form |

## How a page is made

One script and one stylesheet, `kit/v1/kit.js` and `kit/v1/kit.css`, draw everything. A page is the
bar, one mount line and the footer:

```html
<script src="config.js"></script>
<script src="kit/v1/kit.js"></script>
<script>Kit.draw(document.getElementById('page'), 'experiences');</script>
```

`Kit.draw` reads `spine:<family>`, its law `function:<family>`, its kept minutes `<family>`, every
reader's notebook `<family>:<handle>` and its room `pool:<family>` — only what the beach's index says
stands — finds the form in the law, and draws it:

- **a branch family**: rows in the grammar of tree 9.3 (a title in capitals, then the line, references
  for minds left out), a run down digit 1 as one ladder with its side-rooms, and any reading that opens
  with a capital word counted at its node;
- **a document** (`mode: document`): one voice read down its 1, the side-rooms folded away;
- **a clock** (a sundial spine): the ladder at now, from the year down to this beat, with the plan's
  line and every reader's at each rung; adding a reading happens on the walk at happyseaurchin.com;
- **a meeting** (`mode: meeting`): a link to its ring at happyseaurchin.com, never redrawn;
- **a path** (`function:path`): drawn as a branch family, with a link to the path on the site.

Every point can be answered two ways. A reading is kept in the reader's own notebook `<family>:<name>`
at that address; the name and key are asked once and kept on that device, the first reading starts the
notebook, and no passport is ever written. Or a quick note goes into the family's room `pool:<family>`,
signed "<name>, a visitor" so nobody can sign as someone else. Each box takes dictation.

Pages read the beach again every thirty seconds while they are seen. A read that fails says so, apart
from one that finds nothing; when the beach can't be reached, one plain line says that, never a blank
page.

## The beach button

Every page also carries the beach button: one line, served by the beach itself and kept nowhere in
this repository.

```html
<script src="https://beach.happyseaurchin.com/button/button.js" async></script>
```

It is a round button, bottom right, in a frame from the beach's own origin. **unlock** opens the beach's
own window, where a person gives their handle, their passphrase and, if they like, an Anthropic key; with
a key, the button takes a question to the beach and answers it inside itself. Nothing on these pages, the
kit included, can read what is typed into it or kept there. Drag it to move it; **×** puts it away until
the page reloads. How it is built, what it guards against and its limits:
[pscale-commons/pscale-beach `button/`](https://github.com/pscale-commons/pscale-beach/tree/main/button).

It stands beside the kit and is not wired to it yet: the answer box above still asks for a key in the
page and keeps it on the device.

## Make your own

1. On GitHub, choose **Use this template** and name your copy `<your-github-name>.github.io`.
2. In `config.js`, set `handle` to your handle on the beach.
3. GitHub Pages publishes from `main`. Your own blocks then drive what shows: `passport:<handle>`,
   `now:<handle>`, and `lists:<handle>` (branch 1 your projects, branch 2 your places, rank is depth).
4. The beach button's line names the beach that serves it, and a button talks only to that beach. If
   your handle lives on another beach, point the line in each page at `<that beach>/button/button.js`
   (every beach that deploys pscale-beach serves its own), or take the line out.

## Where every part came from

David's own code only. Nothing here comes from Phenomemental/happyseaurchin-beach (it carries no
licence), nor from community-recovery's `look.css`, which is Matthew's stylesheet.

| part | source |
|---|---|
| reads that skip the browser's cache; writes to one block one after another; three plain words offered as a key; read-aloud; `kit/v1/words.js` (copied whole) | [pscale-commons/community-recovery](https://github.com/pscale-commons/community-recovery) `kit.js` and `words.js` (MIT) |
| the key kept per device (`mirror-latch:<family>:<name>`, else `passport-latch:<name>`), the keyed write asked once more when refused, the notebook started by the first reading | happyseaurchin-home `ring.html` (`keyFor`, `remember`, `keyed`) |
| the row grammar, the zero-aware walk, the floor read off the underscores, the mode word | happyseaurchin-home `walk.html` (`titled`, `plain`, `walkZeroAware`, `textAt`, `voice`, `floorOf`, `modeWord`) |
| the go menu's catalogue and the shapes of its links | happyseaurchin-home `theme.js` (`siteDoors`: `WORK`, `GLANCE`, `WITH`, `href`) |
| dictation, copied whole | happyseaurchin-home `theme.js` (`window.dictate`, with the sentence shaping of #427) |
| the colours, light and dark | happyseaurchin-home `theme.css` |
| these pages, the map's grouping, the clock ladder, the answer box | written for this repository (task:weft 31 and 32) |
| the beach button (loaded from the beach, never copied here) | [pscale-commons/pscale-beach](https://github.com/pscale-commons/pscale-beach) `button/` (#81), served at the beach's `/button/` |

The kit speaks the beach's own wire: `GET ?block=<name>` for a block, `GET` with no block for the
index, `POST ?block=<name>` with `{block, content, spindle?, secret?, new_lock?, append?}` to write.

## Not built yet

- Adding a reading on a clock family from these pages; the walk on happyseaurchin.com does it.
- "What waits on me": a place on the home page for what each project agent says is waiting on David,
  once their handovers stand.
- The view line in David's laws, naming where each family is drawn: after these pages publish, at his word.
- The kit moves to pscale-commons only when someone else takes it up.
- The answer box handing its readings to the beach button, so no key is ever typed into these pages.
  The button already writes a reader's own notebook, with the reader's yes; starting a new notebook
  (setting its lock) is not something it does yet.

## Changing the pages

Every script and style link carries a `?v=` mark. Change it in every page when a file changes, so a
browser that visited before picks up the new one. The kit's path is versioned (`kit/v1/`): a change
that would break a page goes to `kit/v2/`. The beach button's line carries no `?v=`: it is not a file
of this repository, and the beach has it checked on every load, so its changes arrive without
touching these pages.
