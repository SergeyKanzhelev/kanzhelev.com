---
tags: kubernetes, governance, thinking-out-loud
---

# Do you need a Working Group?

This is not an article describing what a Kubernetes
[Working Group](https://github.com/kubernetes/community/blob/main/committee-steering/governance/wg-governance.md)
is. This is a warning that you likely do not need one.

If you're even starting to think about a Working Group, it probably means
the change you have in mind is fundamental enough to span multiple
[SIGs](https://github.com/kubernetes/community/blob/main/sig-list.md).
If that's the case — stop by a regular
[SIG Architecture meeting](https://github.com/kubernetes/community/blob/main/sig-architecture/README.md#meetings)
to present your idea. Give a heads-up via the mailing list ahead of time so
people know what you'll be presenting and can plan to attend — SIG Architecture
meetings are often attended based on suggested topics.

Present your idea in the SIGs that will participate. Lead with the feature you
are building, not with the Working Group creation.

SIG Architecture won't make a decision or give approval. They may point you in
the right direction or suggest merging efforts with existing work. They may say
this is not in scope. They may reject the proposal if it doesn't align with
fundamental principles. But SIG Architecture not objecting doesn't mean approval
either — approvals need to come from individual SIGs.

If the idea is sound, no matter how transformational, it can still fit into a KEP.
A recent example is [In-place Update of Pod Resources](https://github.com/kubernetes/enhancements/issues/1287) —
a transformational KEP that spanned many SIGs, many years, many discussions, and
dedicated meetings. It didn't require a Working Group though. I presented
[best practices for approaching KEP development](https://github.com/kubernetes/community/blob/main/sig-node/CONTRIBUTING.md#for-enhancements)
at KCS NA 2023 for another big KEP. I even started creating a Working Group
for my KEP, but it was never "officially formed".

And that's because a Working Group is overhead. It requires at least two chairs,
ideally from different companies. It requires writing a charter and complying with
it. In most cases — regular meetings and annual reports. Lots of paperwork and
approvals. The benefit is much higher visibility of the work. But the price for
that visibility is very high.

So do you need a Working Group? You probably don't.
