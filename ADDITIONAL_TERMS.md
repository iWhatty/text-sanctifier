# Additional Terms — AI Training and Commercial Use

**Effective:** alongside the GNU Affero General Public License v3.0 (the "AGPL-3.0") that governs this Software, for versions of the Software published on or after the date this rider was first attached. Prior versions remain governed by their original license.

These terms are intended to supplement the AGPL-3.0 under Section 7 to the maximum extent permitted. They state the WATT3D project's conditions for commercial use and AI model training. Redistribution of the Software, in source or object form, is permitted only if these terms accompany the Software in the same file or in a clearly-cross-referenced sibling file.

If You want to make Commercial Use of the Software, or use the Software for AI model training, outside the public terms below, You need a separate commercial license from WATT3D.

---

## 1. Definitions

**"You"** has the meaning given in the AGPL-3.0, and additionally includes any organization, employer, principal, or commercial entity on whose behalf You act when exercising rights under this license. Where multiple persons or entities collectively exercise the rights granted here (for example, a contractor working for a client), each is a "You" for the purposes of these terms.

**"Software"** means the work licensed under AGPL-3.0 together with these additional terms, including its source code, comments, documentation, test fixtures, and accompanying assets. References to portions of the Software include copyrightable expression in those materials, including their selection and arrangement.

**"AI Model"** means any machine-learning artifact whose parameters, weights, embeddings, lookup tables, retrieval indices, or equivalent learned state are derived, in whole or in any part, from a training, fine-tuning, distillation, retrieval-augmentation index-building, or analogous data-driven process.

**"Open Weights"** means that **all** of the following are published, free of cost and free of any registration, authentication, or access gate, at a stable public URL, under a license no more restrictive than the AGPL-3.0 with respect to redistribution, modification, and further use:

1. The complete trained parameters of the AI Model.
2. The tokenizer, vocabulary, or equivalent pre-processing artifacts required to run inference.
3. A textual description of the model architecture sufficient for an independent party to load and run the parameters.
4. Inference code, or a clear pointer to a public inference implementation, sufficient to use the AI Model.

Quantization, distillation, or pruning of the AI Model does not satisfy Open Weights unless the artifacts above are released for the full-precision trained model.

**"Fully Open Source"** means that every software work owned, controlled, distributed, or operated by You — including all internal tools, services, infrastructure, and products that involve software, whether or not they incorporate the Software — is publicly released under an OSI-approved license at least as protective of downstream freedoms as the AGPL-3.0, with the source code published in its preferred form for modification at a stable public URL, free of cost and free of any registration, authentication, or access gate.

Non-software business assets — token holdings, financial records, customer data, employee records, corporate governance documents, trade-secret information that does not exist in software form, and the like — are not subject to this requirement. Hardware designs, model weights, configuration, and infrastructure-as-code artifacts that are themselves software, are subject to it.

**"Training Use"** means using the Software, or any portion of the Software of any size, or any work derived from any portion of the Software, as input to:

1. The training of an AI Model from initialization;
2. The fine-tuning, instruction-tuning, RLHF, DPO, or analogous post-training adjustment of an AI Model;
3. The distillation, knowledge-transfer, or output-based training from (i) any AI Model that was itself produced through Training Use of the Software, or (ii) any AI Model whose outputs You knew or reasonably should have known to reflect Training Use of the Software — including chained or multi-hop distillation through one or more intermediate models;
4. The construction of a retrieval-augmented generation (RAG) corpus or vector index, whether the resulting system is offered externally, internally, or kept private.

The fraction, weighting, materiality, or marginal contribution of the Software to the resulting AI Model is **irrelevant** to whether Training Use has occurred. Inclusion of any quantity of the Software — or of any work derived from any portion of the Software — in any of the above is Training Use, regardless of the model's size, the size of the training mixture, or the degree to which the Software measurably influences the model's outputs.

**"Derivative Model"** means any AI Model produced through Training Use of the Software.

**"Commercial Use"** means any use of the Software, or of any Derivative Model, in connection with an activity for which You receive, expect to receive, or compete to receive direct or indirect compensation. This includes but is not limited to:

1. Distribution, sale, licensing, or hosted offering of products or services that incorporate or depend on the Software;
2. Internal use of the Software within a for-profit organization, or within any organization that derives revenue from software, software services, AI services, or data services;
3. Training, fine-tuning, evaluating, distilling, or operating any AI Model that is itself offered commercially, used internally by a commercial entity, or expected to contribute (directly or indirectly) to commercial activity;
4. Use of the Software as part of, or in support of, the research, development, evaluation, or operation of any commercial product, service, model, or infrastructure.

**Training Use is Commercial Use**, regardless of the immediate purpose of the training run, except as expressly exempted in Section 4(c) for non-commercial academic research.

## 2. Commercial Use Restriction

Commercial Use of the Software, or of any Derivative Model, is permitted only if You are **Fully Open Source** at the time of, and throughout, that Commercial Use.

If You are not Fully Open Source, You must not engage in Commercial Use of the Software or of any Derivative Model. The only permitted alternatives are:

(a) bring all software works You own, control, distribute, or operate into compliance with the Fully Open Source definition before continuing Commercial Use; or

(b) obtain a separate commercial license from WATT3D before continuing Commercial Use; or

(c) cease all Commercial Use of the Software and of any Derivative Model, and remove the Software from any commercial product, service, or training pipeline within thirty (30) days of becoming aware of the breach.

This restriction is in addition to, and does not replace, the obligations imposed by the AGPL-3.0 itself.

## 3. Open-Weight Reciprocity

Independently of Section 2, if You make Training Use of the Software, then on or before the date of any deployment, public release, internal use, or further training that exposes the resulting Derivative Model to use by any person or system — whichever occurs first — You must release that Derivative Model under **Open Weights**.

This obligation applies:

- whether or not the Derivative Model is offered to the public;
- whether or not You are Fully Open Source;
- regardless of the Derivative Model's size, parameter count, architecture, or capability;
- regardless of the size of the training mixture or the fraction of the mixture composed of the Software;
- regardless of the degree to which the Software influences the Derivative Model's measurable behavior.

This obligation does not require You to release training data, training code, or training-time hyperparameters — only the artifacts enumerated in the Open Weights definition.

## 4. Exemptions

The following uses of the Software are **exempt** from Sections 2 and 3:

**(a) Transient analysis.** Reading the Software for code review, search indexing, linting, static analysis, or single-prompt code understanding by an AI assistant operating in a per-session context, where (i) no persistent model parameters are updated as a result, and (ii) no portion of the Software is retained in any corpus, index, cache, fine-tuning dataset, or other artifact used for later training or retrieval.

**(b) Personal, non-commercial use.** Use of the Software by a natural person outside the scope of employment, contracting, or for-profit activity, where no Derivative Model is produced and no Commercial Use occurs.

**(c) Academic research.** Non-commercial academic research conducted at, or on behalf of, an accredited academic institution or recognized non-profit research organization, by individuals acting in their academic capacity. Where industry-affiliated researchers participate, the use is exempt only to the extent the research is unfunded by, and not directed by, a commercial sponsor. Any Derivative Model produced under this exemption must be released under Open Weights within twelve (12) months of the first public disclosure (including any preprint, conference talk, or arXiv submission) of related results.

**(d) Attributed citation in human-readable works.** Inclusion of short, attributed quotations from the Software in human-readable works — for example, documentation, blog posts, books, slide decks, or academic citations — provided that such quotations are not used as, or assembled into, training input for any AI Model. This exemption does not authorize bulk inclusion in a training corpus by any path, regardless of the corpus's overall size or composition.

## 5. Notice Requirement

Anyone exercising the rights granted by the AGPL-3.0 in conjunction with these additional terms must retain, in all source and binary distributions:

1. The text of the AGPL-3.0 license;
2. This rider, in full;
3. All prior copyright notices on the Software.

These notices may be carried in a single file or in clearly-cross-referenced sibling files, but must remain readily discoverable from the project root.

## 6. Compatibility and Severability

These additional terms are intended to be compatible with the AGPL-3.0 under Section 7 thereof. If a court of competent jurisdiction finds any specific provision of this rider incompatible with the AGPL-3.0 or otherwise unenforceable, that provision shall be severed and the remainder of the rider and the AGPL-3.0 shall remain in full force. With respect to parties affected by the severance, the Software remains licensed under the AGPL-3.0 alone, and any reciprocity or Commercial Use obligation under this rider shall apply only to the extent it can be reconciled with the AGPL-3.0 grants.

## 7. Termination and Cure

The rights granted under the AGPL-3.0 and this rider terminate automatically upon Your material breach of these additional terms. The rights are reinstated:

(a) **Automatically**, as described in AGPL-3.0 Section 8, if within thirty (30) days of becoming aware of the breach, or of receiving notice of the breach from the copyright holder (whichever is earlier), You either (i) bring Yourself into compliance — including, where applicable, by becoming Fully Open Source, obtaining a separate commercial license, and/or releasing all required Derivative Models under Open Weights — or (ii) cease all Commercial Use of the Software and of any Derivative Model and remove the Software from all commercial pipelines;

(b) **By express reinstatement** from the copyright holder, as described in AGPL-3.0 Section 8, where reinstatement under (a) is not available.

Nothing in this Section limits the reinstatement mechanics provided by AGPL-3.0 Section 8; this Section supplements them with a specific cure window for the obligations introduced by this rider.

## 8. Acceptance

Use, modification, or distribution of the Software, or any Training Use or Commercial Use as defined above, constitutes acceptance of these additional terms.

---

Copyright © 2026 WATT3D. All rights reserved beyond the grants under the AGPL-3.0 and this rider.
