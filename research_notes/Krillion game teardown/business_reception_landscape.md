# Krillion (krillion.io): Business Model, Reception, and the Daily AI Guessing-Game Landscape

> Research date: 2026-11-19. Scope note: **Krillion is not a reverse-Akinator or LLM-chat game.** Per its own FAQ and third-party guides, it is a daily *rarity trivia* game: 7 open-ended prompts, 25 seconds each, and players score more for valid but uncommon answers. An LLM is used **offline** to help assign rarity tiers, not to talk to players live. This matters for every lesson drawn for the planned "reverse Akinator" game, because Krillion's cost and risk profile is closer to Wordle's than to a chat-based game's. Some sources below are low-authority (SEO guide sites, a high-school newspaper, TikTok). Confidence is marked where it matters.

## (a) Monetization and likely running costs

### Takeaway
Krillion is a solo-developer freemium game. The daily mode is free and ad-supported through Mediavine. Paid pack unlocks through Stripe remove ads sitewide, and it also sells merch. No revenue, pricing, or cost figures are public. Because the LLM work happens offline during content curation, inference costs are probably close to zero. The main costs are ordinary hosting (Vercel and Neon) and real-time multiplayer infrastructure (Cloudflare).

### Cited Findings
- **Format:** free browser trivia. The standard "Daily Dive" has 7 prompts with 25 seconds per answer and the same set for everyone. It allows one scored attempt per day and needs no account. Tiers: Plankton 10, Too Clever 15, Schooler 30, Rare 60, Deep Cut 85, One in a Krillion 100. Maximum 700 points (7,000 m) — [AI IDE List guide, 2026-10-21](https://aiidelist.com/blog/krillion-game-guide-how-to-play-rare-answers)
- **Modes and menu:** the landing page lists "Daily dive", "Unlimited", an archive of past dives, themed packs, "Puffer Party", friends, and "Tiers". The only visible commercial element is a merch store ("tees, sweats & caps"). It also cross-promotes Chainle (chainle.io), made by the creator's "little brother" — [krillion.io](https://krillion.io)
- **Ads and paid unlocks:** "Any unlock removes ads site-wide." Linking a Google account carries ad-free status across devices. Pack prices are not listed on the FAQ — [Krillion FAQ](https://krillion.io/faq)
- **Packs:** official packs are Words & Language, Movies, Sports, and Geography, with Music listed as forthcoming. An app and multiplayer are planned "eventually", and a Krillion-based party game is in planning — [AI IDE List creator article, 2026-10-22](https://aiidelist.com/blog/krillion-creator-kp-ai-technology); [Krillion FAQ](https://krillion.io/faq)
- **Stack and vendors (privacy policy effective 2026-09-23):** Vercel (hosting), Neon (database), Cloudflare (Puffer Party hosting and Turnstile bot protection), Google Analytics, Firebase Auth (optional Google sign-in), Stripe (payments), Mediavine and partners (interest-based advertising, including hashed email), and Discord (Discord Activity integration). The policy does **not** mention any AI or LLM provider. Guest daily answers are "checked and discarded" — [Krillion privacy policy](https://krillion.io/privacy)
- **Where AI is used:** answer sets are aggregated from dictionaries, wiki pages, and encyclopedias, then merged and cleaned. Some prompts get rarity from a word and name familiarity database. Others use "LLM assistance plus a manual pass" — [Krillion FAQ](https://krillion.io/faq)
- **Unknown:** the model provider, model version, and whether a model runs per answer — [AI IDE List creator article](https://aiidelist.com/blog/krillion-creator-kp-ai-technology)
- **Rarity is editorial:** rarity is not a live percentage of player submissions, so players often misread it as a vote count — [AI IDE List guide](https://aiidelist.com/blog/krillion-game-guide-how-to-play-rare-answers)
- **No figures:** there are no public revenue, profitability, pricing, or operating-cost numbers, and no substantiated player counts — [AI IDE List creator article](https://aiidelist.com/blog/krillion-creator-kp-ai-technology)
- **Creator:** a solo developer using the pseudonym "kp", a self-described 23-year-old American CS graduate. The FAQ says 23, while the October 2026 secondary article says 22 — [Krillion FAQ](https://krillion.io/faq); [AI IDE List](https://aiidelist.com/blog/krillion-creator-kp-ai-technology)

### Inferences
- The revenue stack is ads first (Mediavine requires meaningful traffic to join, which is indirect evidence of scale), then ad-removal pack unlocks, then merch. This copies the NYT Games and neal.fun playbook of a free daily habit plus optional paid extras, rather than a paywall. (Medium confidence. The Mediavine traffic threshold is general industry knowledge and was not verified in this research.)
- Answers are precomputed, so serving a player costs a lookup, not an inference call. A live yes/no chat game has a fundamentally different cost curve: every question is an inference call. (High confidence in the structural point.)
- **Rough cost estimate for a reverse-Akinator game (my own arithmetic, unverified):**
  - Assume about 20 questions per player per day.
  - Assume each call has about 1,000–1,500 input tokens (system prompt plus fact sheet about the day's person) and a few output tokens.
  - That is about 20–30k input tokens per player per day.
  - At open-model prices of roughly $0.10–$1.00 per million input tokens (Together AI pricing quoted by secondary, conflicting sources: [CloudZero](https://www.cloudzero.com/together-ai-pricing/), [markaicode](https://markaicode.com/pricing/llama-33-pricing-api-cost-production/)), that is about $0.002–$0.03 per player per day.
  - At 100k daily players, that is about $200–$3,000 per day before caching.
  - Prompt caching of the shared daily fact sheet and an answer cache keyed on normalized questions (everyone asks "Is it a man?") could cut this sharply.
  - Treat all of this as an order-of-magnitude sketch only.

### Gaps
- No pack prices were found on public pages, and no revenue, traffic, or Mediavine RPM data exists.
- The LLM vendor and model are unknown, and the privacy policy is silent on AI processing.
- No launch date is published. A student-paper source implies about July 2026 (see below), which is unverified.

## (b) Reception, criticism, and retention

### Takeaway
Krillion appears to have spread virally through TikTok and schools in roughly mid-to-late 2026, with heavy #krillion content. Players praise the timer-driven rush and the "find the rare answer" hook. Complaints focus on disputed rarity tiers, valid answers being rejected, over-generous autocorrect, and a cheating meta (the "James Method"). It has also drawn a wave of copycat domains, including one that Google's AI search misattributed as the original. There are no hard retention numbers. As of 18 November 2026 it was still described as growing.

### Cited Findings
- **Popularity:** a student staff writer at *The Headlight* (Ida B. Wells-Barnett High School student news site; low authority) wrote on 2026-11-18 that the game has existed for about four months, gains "thousands of new players each day", and has "hundreds of thousands of players daily, if not millions." These are the author's estimates, not data — [The Headlight](https://ibwheadlight.com/7600/artsentertainment/krillion-is-this-the-new-big-game/)
- **Praise and score norms:** the same piece credits the 25-second timer, quick thinking, and daily prompts for return visits, plus social media and influencer play. Most players score about 290, and above 400 is "a big achievement" — [The Headlight](https://ibwheadlight.com/7600/artsentertainment/krillion-is-this-the-new-big-game/)
- **Cheating debate:** the "James Method" strategy spread on social media and many players consider it cheating. One student said: "The James Method is really smart, but using it makes you a cheater." The method itself is not described — [The Headlight](https://ibwheadlight.com/7600/artsentertainment/krillion-is-this-the-new-big-game/)
- **Comparison to Wordle:** the article calls it the first daily game "to become huge in a few years" since the Wordle and Connections era — [The Headlight](https://ibwheadlight.com/7600/artsentertainment/krillion-is-this-the-new-big-game/)
- **TikTok:** there are TikTok discover pages titled "Krillion Trivia Game Gameplay Goes Viral" and "All One in A Krillion Answers Today", plus creator videos such as "Starting a journey to be better at Krillion" and "THIS IS MY PEAK." Answer-spoiler accounts exist, which undermines a shared daily puzzle — [TikTok discover](https://www.tiktok.com/discover/krillion-trivia-game-gameplay-goes-viral); [TikTok answers page](https://www.tiktok.com/discover/all-one-in-a-kriilion-answers-today); [@dailyxsav](https://www.tiktok.com/@dailyxsav/video/7702558862867483934)
- **Complaints the developer acknowledges in the FAQ:**
  - Valid answers go missing when a source was overlooked.
  - Generous alias matching causes odd corrections. Example: "sea donkey" maps to Threebanded Sheephead.
  - "Rarity vs fun" trade-offs past a certain depth.
  - The Puffer Party timer seems random (an intentional 10–30 s hidden fuse, made worse by lag). Feedback is directed to the subreddit.

  Source: [Krillion FAQ](https://krillion.io/faq)
- **Recurring disputes:** disputed rarity classifications are a recurring complaint, and the secondary source refers to "scoring controversies" without citing specific incidents — [AI IDE List creator article](https://aiidelist.com/blog/krillion-creator-kp-ai-technology)
- **Copycats and misattribution:** others have claimed to be the creator, and Google's AI search listed a clone's developer as Krillion's creator — [Krillion FAQ](https://krillion.io/faq)
- **Lookalike domains:** krillionio.io, krillion.game, krillion.cc, and Krillionio.com all exist. Krillionio.com runs a different 6-question, 20-second format with "independent editorial ratings." krillion.game describes a prepared answer list with an AI checker fallback — [AI IDE List guide](https://aiidelist.com/blog/krillion-game-guide-how-to-play-rare-answers); [search results incl. krillion.game, krillion.cc](https://krillion.game/)
- **AI vs. players:** a YouTube video titled "I beat Krillion using AI!" exists, and a summary claims AI beats 99% of players. This is unverified. It does show that LLM-assisted cheating is a visible meta — [YouTube](https://www.youtube.com/watch?v=pgFF9ZI8nac)

### Inferences
- **Retention signal:** the game is still expanding, with new packs, Puffer Party multiplayer, a Discord Activity, and an app in planning, and the student piece describes ongoing growth as of November 2026. Nothing suggests it has faded yet, but there is no hard DAU or retention data. (Low–medium confidence.)
- **Lesson:** a viral daily game attracts (1) spoiler and answer accounts, (2) clone domains that take SEO and AI-search credit, and (3) LLM-assisted cheating. A reverse-Akinator game should expect all three from day one: register lookalike domains, add clear creator attribution and schema markup, and design scoring so that "asking ChatGPT" does not trivially win.
- **Lesson:** the biggest complaints are about *judging correctness*, not about the AI being "creepy." For a yes/no oracle about a real person, the analogue is disputed yes/no answers ("the AI said no, but he DID play football in college"). A transparent appeal path, a visible fact basis, or a "Not sure / Partly" answer type will matter.

### Gaps
- No Reddit threads, Hacker News discussion, X posts, or app-store reviews were retrieved. The FAQ references a subreddit, but its name and size are unknown.
- The "James Method" is not described in any source found.
- No independent traffic data (Similarweb or similar) was found.
- No privacy controversy was found, though the Mediavine hashed-email sharing combined with a young, school-age audience is a potential issue (my inference).

## (c) Competitive landscape and LLM-specific pitfalls for a daily "reverse Akinator"

### Takeaway
Direct competitors already exist: Spotted (a daily AI celebrity yes/no game with categories), HiddenFame (an iOS reverse-Akinator), Guessly AI, Guessdle, and generic "20 Questions vs AI" sites. None appears to be news-based or to have broken out. Useful precedents:
- **Wordle:** a free daily habit, acquired by the NYT for "low seven figures."
- **Infinite Craft:** live LLM inference made viable by a global cache, with costs as the hardest problem.
- **Gandalf (Lakera):** an LLM-guarding-a-secret game that drew millions of extraction attempts and became a security-data asset, ending in an acquisition by Check Point.

Research on 20 Questions shows LLMs do not hold a stable hidden secret. A daily game therefore has to fix the answer and facts outside the model.

### Cited Findings

**Direct competitors (AI yes/no person-guessing)**
- **Spotted** ([playspotted.live](https://playspotted.live/))
  - A "Daily Celebrity Detective Game" with a new hidden celebrity daily at midnight GMT.
  - Up to 20 yes/no questions, with clues (the page conflicts on 1 vs 2).
  - 20 categories (Celebrity, Football, Hollywood, Anime…). Solving 9 categories reveals a daily "cube" image. It has streaks, share buttons, and a fewest-questions leaderboard.
  - Described as "powered by AI", with no visible monetization or anti-cheat details.
- **HiddenFame: Guess Who? (iOS)** ([antiakinator.com](https://antiakinator.com/))
  - Billed as "Reverse 20 Questions": the AI picks a celebrity and the player asks questions.
  - Topics: music, cinema, science, sport. Easy/Medium/Hard difficulty, hints with initials, no timer.
  - Answers are **Yes / No / Not only / Unknown**, explicitly to "keep the logic consistent."
  - Not affiliated with Elokence (Akinator's maker). Available in six languages. Pricing is not stated.
- **Other AI guessing games:** Guessly AI (a mystery character in 20 questions), Guessdle (a daily AI word game using yes/no questions), and "Twenty Questions vs AI — Free Daily" (aitwentyquestions.vercel.app) — [Guessly](https://guessly.ai/); [Guessdle](https://www.guessdle.com/); [aitwentyquestions](https://aitwentyquestions.vercel.app/)

**Daily-game precedent: Wordle**
- The NYT bought Wordle on 2022-01-31 for "low seven figures."
- The game stayed free and fed a games-led subscription strategy ("games have become a driver of subscription growth").

Sources: [Nieman Lab](https://www.niemanlab.org/2022/01/the-new-york-times-buys-wordle-for-a-price-in-the-low-seven-figures/); [NPR](https://www.npr.org/2022/01/31/1077089945/nyt-wordle)

**LLM-at-scale precedent: Infinite Craft (Neal Agarwal, Jan 2024)**
- Agarwal told PC Gamer he ran Llama 2, hosted by Together AI, and that popularity forced him to ask Together for more capacity — [PC Gamer](https://www.pcgamer.com/this-browser-based-endless-crafting-game-starts-you-off-with-fire-and-water-but-it-quickly-escalates-to-god-the-big-bang-and-yin-yoda/)
- The backend caches every combination in a global database. Only never-seen pairs hit the LLM — [Arthur O'Dwyer blog, 2024-02-08](https://quuxplusone.github.io/blog/2024/02/08/infinite-craft/) (outside observation); [HN thread](https://news.ycombinator.com/item?id=39205020)
- Agarwal: "Last month was the most money I've ever spent in my life." The project isn't making money but isn't losing money — [Arcader interview](https://arcader.org/news/behind-infinite-craft-one-of-the-internets-favourite-time-killers-its-creator-wrangles-with-ai-alchemy/)
- Agarwal: "The hardest part with Infinite Craft was managing costs and scaling" — [speedrun newsletter](https://speedrun.substack.com/p/three-ai-apps-that-deserve-the-hype)
- These quotes come via search summaries. The full articles were not fetched (medium confidence on exact wording).

**Secret-guarding precedent: Gandalf (Lakera)**
- Players try to trick an LLM into revealing a password.
- Lakera turned the prompts into research data: the "Gandalf the Red" paper released 279k prompt attacks, and Hugging Face datasets note "millions of prompts" — [arXiv 2501.07927](https://arxiv.org/html/2501.07927v3); [HF gandalf_ignore_instructions](https://huggingface.co/datasets/Lakera/gandalf_ignore_instructions/blob/main/README.md?code=true)
- **2023 data exposure:** an exposed dashboard listed about 18M user prompts and 4M password guesses. Lakera said the data was anonymized — [The Register, 2023-09-17](https://www.theregister.com/2023/09/17/gandalf_prompt_injection_game/)
- **Acquisition:** Check Point agreed to acquire Lakera in September 2025 and credited Gandalf with "80 million-plus adversarial patterns." Another source says 35M+, so the figures conflict. As of November 2026, a secondary source reports the old Gandalf URLs redirect to "Agent Breaker" — [HackerDNA](https://hackerdna.com/blog/gandalf-ai); [DEV Community](https://dev.to/gautammanak1/lakera-deep-dive-402g); [iTWire](https://itwire.com/business-it-news/security/lakera-launches-open-source-security-benchmark-for-llm-backends-in-ai-agents-115165)

**Research on LLM consistency in 20 Questions**
- A 2026 paper uses 20 Questions to show LLMs lack stable internal beliefs about a "chosen" secret. It distinguishes explicit contradictions between answers from implicit drift, where the answers point to a different target than the one claimed — [arXiv 2603.25187](https://arxiv.org/pdf/2603.25187)
- Another 2026 paper clones a 20Q chat into branches with different hypothesized secrets to detect inconsistency or deception — [arXiv 2603.07202](https://arxiv.org/html/2603.07202v1)
- **Answer-set precedent:** the 2023–24 Entity-Deduction Arena uses a judge model that knows the secret and answers Yes/No/Maybe ("Dunno" for celebrities) — [arXiv 2310.01468](https://arxiv.org/html/2310.01468v3)

### Inferences (pitfalls and mitigations for a news-based daily reverse Akinator)
- **Consistency:** never let the model "pick" or "remember" the person. Fix the daily answer server-side and give the model a curated, dated fact sheet. Answer each question statelessly against that sheet. The research above shows that hidden-secret play without this anchoring drifts. HiddenFame's four-way answer set (Yes/No/Not only/Unknown) is a cheap fix for ambiguous questions. (High confidence.)
- **Factual accuracy and news recency:** for a news-based figure, the model's training data will be stale. The fact sheet must include the news hook, and "Unknown/Not sure" is safer than a confident wrong answer. Disputed answers are this game's equivalent of Krillion's "missing valid answer" complaints, so plan an appeal or "why?" reveal after the game. (Medium–high confidence, by analogy.)
- **Defamation and real-person risk:** a yes/no oracle about real, news-making people (including those accused of crimes) can produce false factual assertions ("Was he convicted?" "Yes"). Mitigations:
  - Restrict the model to the vetted fact sheet.
  - Refuse or return "Unknown" on criminal allegations, health, sexuality, and similar topics unless the sheet supports them.
  - Avoid private individuals and minors.
  - Log answers per day for review.

  No source found documents a guessing game being sued, so this is a design inference (medium confidence).
- **Prompt injection to reveal the answer:** Gandalf proves that millions of people will try. The best defense is architectural: the model never needs to output the name. A classifier answers only Yes/No/Unknown, and the output is constrained to an enum, so leaking the name is impossible by construction. Final guesses are checked by string or alias matching, not by the LLM. (High confidence on the principle.)
- **Cheating via external AI:** a reverse-Akinator puzzle based on today's news is partly "Googleable" or ChatGPT-able, since a player can paste the yes/no answers into another AI. Krillion's "beat it with AI" videos and the James Method debate show this becomes discourse. Scoring on number of questions and time, as Spotted does, limits the damage. (Medium confidence.)
- **Cost:** Infinite Craft shows that live LLM games can go viral faster than budgets can handle. Mitigations:
  - Use a small or cheap model, since yes/no classification over a fact sheet does not need a frontier model.
  - Cache the prompt for the daily fact sheet.
  - Cache answers for normalized duplicate questions (Infinite Craft-style global cache).
  - Rate-limit questions per player.
  - Use bot protection (Krillion uses Cloudflare Turnstile).
- **Differentiation:** Spotted and HiddenFame already cover the "daily AI celebrity" idea. The open niche is **news-based** (tied to the week's headlines), which also gives a natural publisher or sponsorship angle following Wordle and the NYT. (Medium confidence. No news-based competitor was found, but the search was not exhaustive.)

### Gaps
- No usage, revenue, or growth data was found for Spotted, HiddenFame, Guessly, or Guessdle. Their launch dates and models are unknown.
- Akinator's (Elokence) business model and scale were not researched within the tool budget.
- Semantle and Contexto monetization was not found (the search returned only Wordle results).
- No primary sources were found on prompt-injection attacks against commercial 20Q or guessing games specifically, or on defamation claims against AI trivia games.
- Infinite Craft dollar costs were never disclosed, and current Together AI prices come from conflicting secondary sources.
- No news-based daily "guess the person" game was identified. There may be one that this search missed.
