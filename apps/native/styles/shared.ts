import { StyleSheet } from "react-native";

// ─── Layout ──────────────────────────────────────────────────────────────────
export const layout = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flex: 1, padding: 16 },
  header: { padding: 16 },
  divider: { height: 1, backgroundColor: "#e0e0e0" },
});

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = StyleSheet.create({
  screenTitle: { fontSize: 24, fontWeight: "bold" },
  authTitle: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  authSubtitle: { fontSize: 16, color: "#666", marginBottom: 32 },
  metaLabel: {
    fontSize: 12,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footerText: { fontSize: 14, color: "#666" },
  linkText: { fontSize: 14, color: "#00a86b", fontWeight: "600" },
});

// ─── Form ─────────────────────────────────────────────────────────────────────
export const form = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  // Base button — compose with a margin style per-screen: [form.button, { marginBottom: 24 }]
  button: {
    backgroundColor: "#00a86b",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center" },
});

// ─── Chips / Tags ─────────────────────────────────────────────────────────────
export const chip = StyleSheet.create({
  tag: {
    backgroundColor: "#e8f5ee",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 13, color: "#00a86b" },
});

// ─── Placeholder box ─────────────────────────────────────────────────────────
export const ph = StyleSheet.create({
  box: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
  },
  text: { fontSize: 15, color: "#999" },
});
