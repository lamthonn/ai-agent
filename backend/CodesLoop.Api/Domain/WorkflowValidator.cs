using System.Text.Json;

namespace CodesLoop.Api.Domain;

/// <summary>The same checks the Builder's "Validate" button makes, run again on the server before a version is saved.</summary>
public static class WorkflowValidator
{
    static readonly HashSet<string> Types = ["start", "agent", "condition", "command", "git", "test", "approval", "delay", "end"];

    public static List<string> Check(JsonElement def, ISet<string> knownAgents)
    {
        var errors = new List<string>();
        if (!def.TryGetProperty("nodes", out var nodesEl) || nodesEl.ValueKind != JsonValueKind.Array ||
            !def.TryGetProperty("edges", out var edgesEl) || edgesEl.ValueKind != JsonValueKind.Array)
            return ["Definition needs 'nodes' and 'edges' arrays."];

        var nodes = nodesEl.EnumerateArray().ToList();
        string Id(JsonElement n) => n.TryGetProperty("id", out var v) ? v.GetString() ?? "" : "";
        string Str(JsonElement n, string k) => n.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : "";
        var ids = nodes.Select(Id).ToList();
        if (ids.Any(string.IsNullOrEmpty) || ids.Distinct().Count() != ids.Count) errors.Add("Every node needs a unique id.");

        foreach (var n in nodes.Where(n => !Types.Contains(Str(n, "type")))) errors.Add($"Node '{Id(n)}' has an unknown type.");
        var starts = nodes.Where(n => Str(n, "type") == "start").ToList();
        if (starts.Count != 1) errors.Add($"Needs exactly one start node (has {starts.Count}).");
        if (!nodes.Any(n => Str(n, "type") == "end")) errors.Add("Missing an end node.");

        var edges = edgesEl.EnumerateArray().Select(e => (from: Str(e, "from"), to: Str(e, "to"), when: e.TryGetProperty("when", out var w) ? (bool?)(w.ValueKind == JsonValueKind.True ? true : w.ValueKind == JsonValueKind.False ? false : null) : null)).ToList();
        foreach (var e in edges.Where(e => !ids.Contains(e.from) || !ids.Contains(e.to))) errors.Add($"Edge {e.from} → {e.to} points to a node that does not exist.");

        if (starts.Count == 1)
        {
            var seen = new HashSet<string>(); var stack = new Stack<string>([Id(starts[0])]);
            while (stack.Count > 0) { var x = stack.Pop(); if (!seen.Add(x)) continue; foreach (var e in edges.Where(e => e.from == x)) stack.Push(e.to); }
            foreach (var id in ids.Where(i => !seen.Contains(i))) errors.Add($"Node '{id}' cannot be reached from start.");
        }

        foreach (var n in nodes.Where(n => Str(n, "type") == "agent"))
            if (!knownAgents.Contains(Str(n, "agent"))) errors.Add($"Node '{Id(n)}' uses an unknown agent.");
        foreach (var n in nodes.Where(n => Str(n, "type") == "condition"))
        {
            var outs = edges.Where(e => e.from == Id(n)).ToList();
            if (string.IsNullOrWhiteSpace(Str(n, "expr"))) errors.Add($"Condition '{Id(n)}' has no expression.");
            if (outs.Count != 2 || !outs.Any(e => e.when == true) || !outs.Any(e => e.when == false))
                errors.Add($"Condition '{Id(n)}' needs one branch with when=true and one with when=false.");
        }

        // A loop is only allowed if it passes through a node with a round limit: drop those nodes, nothing may cycle.
        var limited = nodes.Where(n => n.TryGetProperty("maxLoops", out var m) && m.ValueKind == JsonValueKind.Number).Select(Id).ToHashSet();
        var state = new Dictionary<string, int>();   // 1 = on the path, 2 = done
        bool Cycle(string x)
        {
            state[x] = 1;
            foreach (var e in edges.Where(e => e.from == x && !limited.Contains(e.to) && ids.Contains(e.to)))
                if (state.GetValueOrDefault(e.to) == 1 || (state.GetValueOrDefault(e.to) == 0 && Cycle(e.to))) return true;
            state[x] = 2; return false;
        }
        if (ids.Where(i => !limited.Contains(i)).Any(i => state.GetValueOrDefault(i) == 0 && Cycle(i)))
            errors.Add("A loop does not pass through any node with a round limit (maxLoops).");
        return errors;
    }
}
