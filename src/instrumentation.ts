export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "development") {
    const { setDefaultAutoSelectFamily } = await import("node:net");
    setDefaultAutoSelectFamily(false);
  }
}
