# Additional Terms — AI Training Rider

**Effective:** alongside the GNU Affero General Public License v3.0 (the "AGPL-3.0") that governs this Software, for versions of the Software published on or after the date this rider was first attached. Prior versions remain governed by their original license.

These terms are additional terms within the meaning of Section 7 of the AGPL-3.0. They form an integral part of the license under which this Software is offered. Redistribution of the Software, in source or object form, is permitted only if these terms accompany the Software in the same file or in a clearly-cross-referenced sibling file.

> **Note:** This rider is authored by a non-lawyer for the WATT3D project. Treat it as a starting point. Have it reviewed by qualified counsel before relying on it for enforcement.
>
> **Open question for counsel.** Section 2's obligation reaches some uses that AGPL-3.0 itself would not reach without a distribution or network-deployment trigger (notably, AI Models used exclusively for internal commercial purposes). Whether this scope is preserved, narrowed, or restructured is a deliberate decision pending legal review.

---

## 1. Definitions

**"You"** has the meaning given in the AGPL-3.0.

**"Software"** means the work licensed under AGPL-3.0 together with these additional terms, including its source code, comments, documentation, test fixtures, and accompanying assets.

**"Substantive portion"** means a portion of the Software that, alone or aggregated with other portions used together, materially contributes to the training signal, retrieved context, or learned behavior of the resulting AI Model. A portion need not constitute a majority or even a large fraction of the training data to be Substantive — what matters is whether the AI Model's behavior, knowledge, or capability is meaningfully informed by the Software. Dilution of the Software with additional training data does not, by itself, render a portion non-Substantive.

**"AI Model"** means any machine-learning artifact whose parameters, weights, embeddings, lookup tables, or equivalent learned state are derived, in whole or substantial part, from a training, fine-tuning, distillation, retrieval-augmentation index-building, or analogous data-driven process.

**"Open Weights"** means that **all** of the following are published, free of cost and free of any registration, authentication, or access gate, at a stable public URL, under a license **no more restrictive than the AGPL-3.0** with respect to redistribution, modification, and further use:

1. The complete trained parameters of the AI Model.
2. The tokenizer, vocabulary, or equivalent pre-processing artifacts required to run inference.
3. A textual description of the model architecture sufficient for an independent party to load and run the parameters.
4. Inference code, or a clear pointer to a public inference implementation, sufficient to use the AI Model.

Quantization, distillation, or pruning of the AI Model does not satisfy Open Weights unless the artifacts above are released for the **full-precision** trained model.

**"Training Use"** means using the Software, or any Substantive portion thereof, as input to:

1. The training of an AI Model from initialization;
2. The fine-tuning, instruction-tuning, RLHF, DPO, or analogous post-training adjustment of an AI Model;
3. The distillation, knowledge-transfer, or output-based training from (i) any AI Model that was itself produced through Training Use of the Software, or (ii) any AI Model whose outputs You knew or reasonably should have known to reflect Training Use of the Software — including chained or multi-hop distillation through one or more intermediate models;
4. The construction of a retrieval-augmented generation (RAG) corpus or vector index, whether the resulting system is offered externally, internally, or kept private.

**"Derivative Model"** means any AI Model produced through Training Use of the Software.

## 2. Open-Weight Reciprocity

If You make Training Use of the Software, then on or before the date of any deployment, public release, or internal commercial use of the resulting Derivative Model, whichever occurs first, You must release that Derivative Model under Open Weights.

This obligation applies whether or not the Derivative Model is offered to the public, including:

- AI Models embedded in proprietary products, plugins, or extensions;
- AI Models offered via API, web interface, or hosted inference endpoint;
- AI Models used exclusively for internal commercial purposes;
- AI Models distributed under non-disclosure terms.

This obligation does **not** require You to release training data, training code, or training-time hyperparameters — only the artifacts enumerated in the **Open Weights** definition.

## 3. Exemptions

The following uses of the Software are **exempt** from Section 2:

**(a) Transient analysis.** Reading the Software for code review, search indexing, linting, static analysis, or single-prompt code understanding by an AI assistant operating in a per-session context, where no persistent model parameters are updated as a result.

**(b) Attributed quotations.** Inclusion of short, attributed quotations from the Software in works primarily composed of other material — for example, in documentation, blog posts, books, or academic citations — provided that no Derivative Model is principally derived from those quotations. This exemption does not extend to bulk inclusion of the Software in a training corpus, regardless of the corpus's overall size: dilution by other training data does not, by itself, take a use outside Section 2.

**(c) Academic research.** Non-commercial academic research conducted at, or on behalf of, an accredited academic institution or recognized non-profit research organization, by individuals acting in their academic capacity. Where industry-affiliated researchers participate, the use is exempt only to the extent the research is unfunded by, and not directed by, a commercial sponsor. Any Derivative Model and the results derived from it must be published under Open Weights within twelve (12) months of the first public disclosure (including any preprint, conference talk, or arXiv submission) of those results.

**(d) Pure inference.** Running an AI Model that was not itself produced through Training Use of the Software, even where the Software is invoked at inference time (for example, as a library called by the inference process).

## 4. Notice Requirement

Anyone exercising the rights granted by the AGPL-3.0 in conjunction with these additional terms must retain, in all source and binary distributions:

1. The text of the AGPL-3.0 license;
2. This rider, in full;
3. All prior copyright notices on the Software.

These notices may be carried in a single file or in clearly-cross-referenced sibling files, but must remain readily discoverable from the project root.

## 5. Compatibility and Severability

These additional terms are intended to be compatible with the AGPL-3.0 under Section 7 thereof. If a court of competent jurisdiction finds any specific provision of this rider incompatible with the AGPL-3.0 or otherwise unenforceable, that provision shall be severed and the remainder of the rider and the AGPL-3.0 shall remain in full force. With respect to parties affected by the severance, the Software remains licensed under the AGPL-3.0 alone, and any reciprocity obligation under this rider shall apply only to the extent it can be reconciled with the AGPL-3.0 grants.

## 6. Termination and Cure

The rights granted under the AGPL-3.0 and this rider terminate automatically upon Your material breach of these additional terms. The rights are reinstated:

(a) **Automatically**, as described in AGPL-3.0 Section 8 first paragraph, if You cease the breach and bring all required releases under Open Weights within thirty (30) days of becoming aware of the breach, or of receiving notice of the breach from the copyright holder, whichever is earlier;

(b) **By express reinstatement** from the copyright holder, as described in AGPL-3.0 Section 8 second paragraph, where reinstatement under (a) is not available.

Nothing in this Section limits the reinstatement mechanics provided by AGPL-3.0 Section 8; this Section supplements them with a specific cure window for the obligations introduced by this rider.

## 7. Acceptance

Use, modification, or distribution of the Software, or any Training Use as defined above, constitutes acceptance of these additional terms.

---

Copyright © 2026 WATT3D. All rights reserved beyond the grants under the AGPL-3.0 and this rider.
