# Additional Terms — AI Training Rider

**Effective:** alongside the GNU Affero General Public License v3.0 (the "AGPL-3.0") that governs this Software.

These additional terms are non-permissive additional terms within the meaning of Section 7 of the AGPL-3.0. They form an integral part of the license under which this Software is offered. Redistribution of the Software, in source or object form, is permitted only if these terms accompany the Software in the same file or in a clearly-cross-referenced sibling file.

> **Note:** This rider is authored by a non-lawyer for the WATT3D project. Treat it as a starting point. Have it reviewed by qualified counsel before relying on it for enforcement.

---

## 1. Definitions

**"Software"** means the work licensed under AGPL-3.0 together with these additional terms, including its source code, comments, documentation, test fixtures, and accompanying assets.

**"AI Model"** means any machine-learning artifact whose parameters, weights, embeddings, lookup tables, or equivalent learned state are derived, in whole or substantial part, from a training, fine-tuning, distillation, retrieval-augmentation index-building, or analogous data-driven process.

**"Open Weights"** means that **all** of the following are published, free of cost and free of any registration, authentication, or access gate, at a stable public URL, under a license at least as permissive of redistribution and modification as the AGPL-3.0:

1. The complete trained parameters of the AI Model.
2. The tokenizer, vocabulary, or equivalent pre-processing artifacts required to run inference.
3. A textual description of the model architecture sufficient for an independent party to load and run the parameters.
4. Inference code, or a clear pointer to a public inference implementation, sufficient to use the AI Model.

Quantization, distillation, or pruning of the AI Model does not satisfy Open Weights unless the artifacts above are released for the **full-precision** trained model.

**"Training Use"** means using the Software, or any substantive portion thereof, as input to:

1. The training of an AI Model from initialization;
2. The fine-tuning, instruction-tuning, RLHF, DPO, or analogous post-training adjustment of an AI Model;
3. The distillation or knowledge-transfer from any model that was itself produced through Training Use of the Software;
4. The construction of a retrieval-augmented generation (RAG) corpus or vector index that is offered as part of a product or service.

**"Derivative Model"** means any AI Model produced through Training Use of the Software.

## 2. Open-Weight Reciprocity

If You make Training Use of the Software, then on or before the date of first public availability, internal commercial deployment, or external commercial deployment of any Derivative Model (whichever occurs first), You must release that Derivative Model under Open Weights.

This obligation applies whether or not the Derivative Model is offered to the public, including:

- AI Models embedded in proprietary products, plugins, or extensions;
- AI Models offered via API, web interface, or hosted inference endpoint;
- AI Models used exclusively for internal commercial purposes;
- AI Models distributed under non-disclosure terms.

This obligation does **not** require You to release training data, training code, or training-time hyperparameters, only the artifacts enumerated in the **Open Weights** definition.

## 3. Exemptions

The following uses of the Software are **exempt** from Section 2:

**(a) Transient analysis.** Reading the Software for code review, search indexing, linting, static analysis, or single-prompt code understanding by an AI assistant operating in a per-session context, where no persistent model parameters are updated as a result.

**(b) Quoted snippets in mixed corpora.** Inclusion of attributed quotations from the Software in a training corpus primarily composed of other works, provided that no Derivative Model is principally derived from the Software. As a safe harbor, a corpus in which the Software constitutes less than one one-thousandth (0.1%) of total tokens, measured against the full training mixture, is presumed not to be principally derived from the Software.

**(c) Academic research.** Non-commercial academic research, provided that any Derivative Model and the results derived from it are published under Open Weights within twelve (12) months of the first publication or preprint disclosing those results.

**(d) Pure inference.** Running an AI Model that was not itself produced through Training Use of the Software, even where the Software is invoked at inference time (for example, as a library called by the inference process).

## 4. Notice Requirement

Anyone exercising the rights granted by the AGPL-3.0 in conjunction with these additional terms must retain, in all source and binary distributions:

1. The text of the AGPL-3.0 license;
2. This rider, in full;
3. All prior copyright notices on the Software.

These notices may be carried in a single file or in clearly-cross-referenced sibling files, but must remain readily discoverable from the project root.

## 5. Compatibility

These additional terms are intended to be compatible with the AGPL-3.0 under Section 7 thereof. If a court of competent jurisdiction finds any specific provision of this rider incompatible with the AGPL-3.0, that provision shall be severed and the remainder of the rider and the AGPL-3.0 shall remain in full force, except that the Software remains licensed under the AGPL-3.0 alone for the parties affected by the severance.

## 6. Termination

The rights granted under the AGPL-3.0 and this rider terminate automatically upon Your material breach of these additional terms. Rights are reinstated as described in AGPL-3.0 Section 8.

## 7. Acceptance

Use, modification, or distribution of the Software, or any Training Use as defined above, constitutes acceptance of these additional terms.

---

Copyright © 2026 WATT3D. All rights reserved beyond the grants under the AGPL-3.0 and this rider.
