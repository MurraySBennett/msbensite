# Background

Teams can accomplish more than individuals — but are they actually more *efficient*? Taking a colleague to work on a project together is only worthwhile if the coordination overhead doesn't eat up the gains. Measuring that overhead rigorously, with a method that goes beyond comparing raw scores, requires a benchmark: something to compare observed team performance against.

This project does two things. First, it develops and applies **workload capacity analysis** to a novel dynamic team task — providing a psychometrically grounded measure of team efficiency that can detect whether teamwork helps, hurts, or is simply neutral relative to independent work. Second, it examines what teamwork costs the *individual*: does coordinating with another person consume cognitive resources, and does the social context (collaborating vs. competing) change that cost?

The experiment used an online multiplayer game inspired by Pong, purpose-built to allow precise experimental control over workload, team structure, and measurement. [You can try a version of it here.](/experiment-demo-viewer.html?demo=team-spirit-hh)

# Analyses & Methodology

## Task and Conditions

Participant pairs played a ball-deflection game in three social conditions:

- **Separate** — each player works independently, each responsible for their own set of balls
- **Collaborative** — both players share a single team score and can interact with all balls
- **Competitive** — players attempt to outscore each other, with access to all balls

This design allows clean comparisons of individual performance against collaborative and competitive teamwork, using the same task and the same participants.

## Workload Capacity Analysis

The central analytical tool is the **Survivor Function Inequality** from Systems Factorial Technology. This compares observed team performance against the **UCIP benchmark** — the theoretical performance two independent, unlimited-capacity players would achieve if working simultaneously without any interaction.

When a team falls below the UCIP benchmark, they exhibit *limited capacity*: the act of coordinating is costing them performance relative to two people simply working in parallel. When they exceed it, they exhibit *super capacity*: genuine synergy beyond what independent work would predict.

This framework transforms "did the team score more points?" into a principled question about efficiency — accounting for the fact that two people *should* outperform one person, and asking whether they outperform the right amount.

## Detection Response Task

To measure individual cognitive load during the game, participants responded to brief light flashes presented concurrently with the main task (the Detection Response Task). Slower or less accurate responses to these probes indicate that the main task is consuming more cognitive resources — allowing us to directly measure the mental cost of teamwork, separate from its effect on performance.

## n-Balls Maintained Transformation

To make the miss rate data more intuitive, we developed a transformation that expresses performance as the number of balls a player or team could maintain at a fixed accuracy level. This allows direct comparison across conditions in tangible terms: a collaborative team maintaining 7 balls is handling substantially more than an individual managing 4, even if the raw miss rates don't make that obvious.

![n-balls maintained transformation](/assets/images/team-spirit-hh/nBalls_maintained.png)

# Outcomes & Conclusions

## Teams Score More, but Efficiency Costs Are Real

Both collaborative and competitive teams kept significantly more balls in play than individuals. But the workload capacity analysis revealed that neither team type performed as well as two independently-working individuals *would* have performed working in parallel. Both fell below the UCIP benchmark — limited capacity — indicating that the act of coordinating introduced costs that offset some of the productivity gains.

![Workload capacity results for collaborative and competitive teams](/assets/images/team-spirit-hh/HH-CapacityMR.png)

## Collaboration Beats Competition on Efficiency

The efficiency cost was significantly smaller for collaborative teams than competitive ones. Working toward a shared goal is more efficient than trying to outscore a partner on the same task. This finding has practical implications for the design of human-AI teams: framing the relationship as collaborative — a shared objective, not a performance competition — should reduce coordination costs.

## Teamwork Increases Cognitive Load

The DRT data showed elevated cognitive load in both team conditions relative to the independent baseline. Even without any direct communication, the mere act of coordinating with another person consumes cognitive resources. This result was clearest at low workload levels, where the task itself imposed less of a ceiling.

## Extension: Real-Time Cognitive Modelling

Subsequent work by Fitch, Hedley, Bennett & Kvam (in press, *Scientific Reports*) applied a transformer-based simulation-inversion network to Team Spirit data, fitting a novel Collaborative-Competitive Interception Model (CCIM) in real time from continuous paddle movement data. The CCIM recovers interpretable parameters — urgency sensitivity, approach-avoidance gradient, planning horizon — that predict both individual behaviour and team-level coordination outcomes. This opens a path toward AI agents that continuously model their human teammates during live interaction.

## Conclusion

Workload capacity analysis provides a tool for distinguishing genuine team synergy from the mere addition of a second person. In human-human teams, teamwork introduces measurable efficiency costs regardless of goal framing — but those costs are systematically smaller when teams collaborate rather than compete. These findings now form the baseline for ongoing work examining how AI agents change this picture when substituted for human teammates.
