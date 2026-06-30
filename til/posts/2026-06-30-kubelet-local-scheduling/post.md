---
tags: roadmap, kubernetes, thinking-out-loud
---

# Kubelet roadmap: defer, don't decide

There's a shift happening in how kubelet handles pod admission. Instead of making
a final decision on the spot — admit or reject — kubelet is learning to wait.

The latest example: [device plugin registration on node reboot](https://github.com/kubernetes/kubernetes/pull/139959).
When a node restarts, kubelet re-admits existing pods in arbitrary order. A pod
needing a device plugin resource could easily come up before the plugin itself registers.
Until now, kubelet would reject that pod with an `UnexpectedAdmissionError` — and
for raw (non-controller-managed) pods, that meant stuck forever.

The fix is simple in concept: defer the pod instead of rejecting it. Wait for
the device plugin to register (with a timeout), then retry admission. No changes
to the device plugin interface needed.

A similar pattern is emerging for [in-place pod resize](https://github.com/kubernetes/kubernetes/issues/139996).
Kubelet's `CriticalPodAdmissionHandler` has its own preemption logic that differs
from the scheduler — it doesn't consider PodDisruptionBudgets, PreemptionPolicy,
or workload-aware scheduling. The proposal: stop doing kubelet-side critical pod
preemption for resizes and let the scheduler handle it instead. Accept the extra
latency of a scheduler round-trip in exchange for correct preemption semantics.

The broader pattern is kubelet stepping back from decisions it shouldn't be making
alone. In the future this could extend further — gang scheduling where kubelet
waits for all gang members to find allocations before starting any of them, or
sequencing where the next workload is held until the moment a predecessor completes.

Resources are precious, and kubelet adopts for the emerging changing workload patterns.
