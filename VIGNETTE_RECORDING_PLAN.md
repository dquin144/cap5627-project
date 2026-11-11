# Vignette Recording Plan — four check-in strategies (v0.5)

**For:** the Team 3.2 members who record the evaluation videos, and the instructor/TA reviewing the study materials.
**Status:** plan and tooling ready. The lines are **candidates until the team approves them**, and the instructor has **not yet approved** a four-condition design (see section 5).

## 1. What is manipulated

All four clips show the **same situation**:
- the same agent, voice, framing, background and stimulus;
- the same AU4 cue and the same response delay;
- similar length (15–19 words in the template set).

**Only the agent's check-in strategy differs.**

**Common stimulus.** A student lowers their brows (AU4) and says: **"I'm really stressed about my exams."** Under the gate (AU4 ≥ 45 AND verbal concern), the check-in fires in every clip.

## 2. The four strategies

These are the team's definitions:

| Strategy level | What the SIA does |
|---|---|
| Explicit + providing space | References the concern; invites the user to say more. |
| Explicit + reducing space | References the concern; then moves on. |
| Non-explicit + providing space | Invites elaboration without referencing the concern. |
| Non-explicit + reducing space | Moves on without referring to the concern. |

The two dimensions come from VR-CoDES-P (VR-CoDES 2017 manual, Del Piccolo et al., EACH).
- **Explicit:** the response mentions the topic or the emotion of the concern, using the same or similar words. **Non-explicit:** it mentions neither; if in doubt, it counts as non-explicit.
- **Providing space:** the response gives room for further disclosure. **Reducing space:** it closes further disclosure down.

**Every line has two sentences, forming a 2×2.**
- **Sentence 1** carries explicitness: it either references the concern or is a neutral acknowledgement.
- **Sentence 2** carries space: it either invites more or moves on.

The four arms therefore differ only on the two study dimensions. **No arm gives advice, tips or reassurance.** These appear nowhere in the definitions, and adding them to some arms would confound the comparison. The prompt forbids them and the validator rejects them.

| # | ID | Sentence 1 (explicitness) | Sentence 2 (space) | Words |
|---|---|---|---|---|
| 1 | `explicit_provides_space` | "It sounds like your exams are stressing you out." | "Could you tell me more about what's been going on?" | 19 |
| 2 | `explicit_reduces_space` | "It sounds like your exams are stressing you out." | "Let's go ahead and continue with the next part." | 18 |
| 3 | `nonexplicit_provides_space` | "Okay, I see what you mean." | "Could you tell me more about what's been going on?" | 16 |
| 4 | `nonexplicit_reduces_space` | "Okay, I see what you mean." | "Let's go ahead and continue with the next part." | 15 |

These are the template lines (the fallback, and a ready-made candidate set). LLM wording follows the same two-sentence structure; if you approve LLM lines instead, keep the shared parts identical across arms where you can.

Notes for the team review:
- **The non-explicit opener** "Okay, I see what you mean." acknowledges that the student spoke but does not mention the exams or the stress. The manual codes "I see" as non-explicit. If the team feels any acknowledgement is too much for the non-explicit + reducing space arm, the alternative is a bare "Okay." Change `eval_config.json` `templates`, accept the shorter length, and record the choice here.
- **The invitation** "what's been going on" is general wording. After an explicit opener the invitation clearly refers to the concern; after the neutral opener it does not name it, which is what keeps arm 3 non-explicit.
- **Dismissive wording** ("don't worry", "not a big deal") is rejected in every arm. The manual treats it as active blocking, which devalues the feeling; using it would test rudeness, not space.

## 3. Choose how the stimulus is produced (decide as a team; disclose it)

| Option | Input mode | Stimulus identical across clips? | What viewers see | Disclosure |
|---|---|---|---|---|
| **A. Simulated stimulus** | SIMULATED DEMO | Yes: same text and synthetic AU4 = 70 every time | Agent only. Turn on Captions to show "Student: I'm really stressed about my exams." | The trigger values are **simulated**. Tell the instructor/TA, and do not present the clips as live detections. |
| **B. Live face, fixed text** | LIVE FACE + TYPED TEXT | Text identical; the face is live (retake if AU4 < 45) | Actor's webcam preview + agent | AU4 is a live measurement; the transcript was typed by the operator (not speech-to-text) |
| **C. Fully live** | LIVE | Varies take to take | Actor + agent | Fully live; the transcript can be misheard (retake) |
| **D. One real stimulus, four responses** | Any; edit afterwards | Yes: one actor take spliced before each response | Actor + agent | Edited composite. **Needs instructor approval.** |

Recommendation for Thursday: **Option B** if the camera and AU4 are reliable on the recording machine; otherwise **Option A**. Whatever you choose, record it per clip in section 4. If a real person's face or voice appears, get that person's consent first, and do not post the videos publicly.

## 4. Recording procedure

**Prepare the four lines (once):**
1. Run the smoke test in `USER_EVAL_IMPLEMENTATION.md` §5.
2. Set Input to the chosen mode and Wording to **LLM generated**. For each strategy, click **Start scenario** a few times and read the `Check-in:` line. When a line fits its row in section 2 and is 15–22 words, click **Approve last line**. You can also approve a template line (Wording = Template).
3. Have a second team member check the four approved lines against the manual definitions above.
4. Click **Export log**, then copy `approvedUtterances` into `eval_config.json` and commit it. The lines are now frozen in the repository, independent of the browser.

**Record each clip:**
5. Set Wording to **Approved line (frozen)**, Min. response delay to **3000 ms** (or more than the slowest LLM classifier time seen in smoke test #4), and decide on captions (same setting for all four).
6. Select the strategy. Click **Recording view**, start your screen recorder (OS recorder or OBS, capturing the eEVA tab, same window size each time), then click **Run**. The panel hides while the scenario runs.
7. Stop recording about 2 s after the agent finishes. Click **Exit recording view** and confirm in the report: `Decision: CHECK IN`, `Wording source: approved`, the right strategy, `spoken: true`.
8. Name the file: `strategy_0N_<id>_<option>_take<k>.mp4`, for example `strategy_01_explicit_provides_space_B_take2.mp4`. In the survey, rename to neutral names (`clip_A.mp4` …) so participants never see condition labels.
9. Fill in one row of the log below. At the end, **Export log** and save the JSON with the clips (in private team storage, not the public repo, if it contains anything identifying).

| File | Strategy | Option (A–D) | Simulated? | AU4 peak | Transcript source | Wording source | Exact line spoken | Response delay (ms) | Duration (s) | Date/time | Operator | Commit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | |

## 5. Survey design (pending instructor confirmation)

The instructor's email describes **two versions** and a session of at most 15 minutes, including both questionnaires. Four clips may not be the approved design.
- **Two-version design:** pick two clips. The contrast that tests the core idea is EP vs NR, which differs on both dimensions. Counterbalance AB/BA, with the identical PETS-based questionnaire after each.
- **Four-clip design (only if approved):**
  - Show all four in a balanced Latin square, with the same short questionnaire after each. Assign each participant one row. In Qualtrics, use a Randomizer element with one branch per order and "Evenly present elements" turned on.

    | Order | 1st | 2nd | 3rd | 4th |
    |---|---|---|---|---|
    | 1 | EP | ER | NR | NP |
    | 2 | ER | NP | EP | NR |
    | 3 | NP | NR | ER | EP |
    | 4 | NR | EP | NP | ER |

    Each strategy appears once in each position, and each strategy directly follows every other exactly once.
  - Time budget: about 20 s per clip plus about 1.5–2 min per questionnaire gives about 8–9 min, plus consent, instructions and debrief. Time it in the Nov 12 dry run.
- Ask respondents to **imagine themselves as the student** in the clip.
- Use the approved PETS items verbatim, and do not label added items as validated.
- Delete dry-run responses and reset the randomizer counts before Nov 16.

## 6. Classifier check lines (optional, on platform)

Use **LIVE FACE + TYPED TEXT** with a frown, detector = LLM. Expected labels:

| Line | Expected |
|---|---|
| I'm stressed about my exams. | concern → CHECK IN |
| I've had a really difficult week. | concern → CHECK IN |
| I don't think I can keep up. | cue → CHECK IN |
| Everything is piling up, and I can't catch a break. | cue → CHECK IN (keywords would miss it) |
| I'm not stressed anymore. | none → no check-in (keywords would fire) |
| I'm not worried. | none → no check-in (keywords would fire) |
| We're discussing stress in class. | none → no check-in |
| We're discussing how stressed students get. | none → no check-in (keywords would fire) |
| I finished my homework. | none → no check-in |
| I'm doing pretty well. | none → no check-in |

Record the results in the export. They describe this build's detector only; they are not baseline data.
