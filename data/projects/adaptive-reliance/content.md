# Background

Giving someone an AI assistant does not straightforwardly make them better at their job. It can improve the output of the human–AI system, or it can hollow out the human contribution while leaving the appearance of performance intact. Telling those apart takes more care than asking whether accuracy went up.

The programme rests on distinctions that are usually collapsed. **Trust** is a belief about the AI's competence. **Reliance** is an observable action — accepting, consulting, copying, or failing to check. **Calibration** is the match between reliance and the AI's competence *on this particular case*. **Cognitive offloading** is a change in what the person encodes, searches, or verifies because the AI is there at all.

Treating these as synonyms produces a specific inferential error. Faster responses with AI might reflect a sensible division of labour, or shallow verification, or both at once — and an aggregate accuracy figure cannot distinguish them. Equally, rejecting correct advice is not healthy scepticism.

# The Model

On each case the person receives evidence, may receive AI advice, and produces a response. Five time-varying processes connect the task to the behaviour: the quality of the person's own evidence, their perceived reliability of the AI, a reliance policy weighting the two, the verification effort spent checking independently, and a workload or fatigue state that moves all of the above.

For continuous judgements this gives a weighted combination of an independent pre-advice judgement and the AI's recommendation. For binary decisions it becomes a sequential-sampling model in which human and AI evidence jointly drive the drift rate, trust shifts the starting point, and verification effort moves the decision boundary.

The reliance weight is the quantity of interest. Whether it tracks the AI's case-by-case competence — rather than settling into a habit formed early and applied indiscriminately — is what separates calibration from mere reliance.

# Application

The applied case is radiology report generation, in collaboration with the OSU Medical Center.

The programme is deliberately broader than that one clinical study. The same constructs, manipulations and analysis framework run first with student and online samples, then carry into resident and expert studies where participants are scarce and expensive. Building the measurement apparatus somewhere cheap, then moving it somewhere costly, is the point.
