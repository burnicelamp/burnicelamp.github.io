// Shared by browser search, related content, random entry and offline index generation.
export const kinds = {
  music: "声场",
  cinema: "银幕",
  books: "书页",
  darkroom: "暗房",
  notes: "记录",
};
export const sectionFor = (kind) => (kind === "books" ? "reading" : kind);
export const normalized = (x) =>
  String(x ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .trim();
export function catalog(data) {
  return Object.keys(kinds).flatMap((kind) =>
    (data[kind]?.[kind === "music" ? "tracks" : "items"] || [])
      .filter((x) => x.published !== false && x.placeholder === false)
      .filter(
        (x) =>
          kind !== "darkroom" ||
          data.darkroom.rolls?.some(
            (r) => r.id === x.rollId && r.published !== false,
          ),
      )
      .map((item) => ({
        key: `${kind}:${item.id}`,
        kind,
        id: item.id,
        title: item.title || item.alt || item.id,
        author: item.author || "",
        artist: item.artist || "",
        director: item.director || "",
        location: item.location || "",
        year: String(item.year || item.date?.slice(0, 4) || ""),
        tags: item.tags || [],
        text: [
          item.title,
          item.author,
          item.artist,
          item.album,
          item.director,
          item.location,
          item.date,
          item.year,
          item.note,
          item.text,
          item.summary,
          item.review,
          item.alt,
          item.caption,
          ...(item.tags || []),
        ]
          .filter(Boolean)
          .join(" "),
      })),
  );
}
const aliases = {
  作者: "author",
  艺人: "artist",
  导演: "director",
  地点: "location",
  年份: "year",
  标签: "tags",
  类型: "kind",
  author: "author",
  artist: "artist",
  director: "director",
  location: "location",
  year: "year",
  tag: "tags",
  type: "kind",
};
export function parseQuery(input) {
  const filters = [];
  const text = normalized(input).replace(
    /([\p{L}]+)\s*[:：]\s*(?:"([^"]+)"|“([^”]+)”|([^\s]+))/gu,
    (whole, key, a, b, c) => {
      if (!aliases[key]) return whole;
      filters.push({ field: aliases[key], value: a || b || c });
      return " ";
    },
  );
  return { terms: text.split(/\s+/).filter(Boolean), filters };
}
export function search(entries, input) {
  const { terms, filters } = parseQuery(input);
  return entries
    .filter(
      (e) =>
        filters.every((f) =>
          normalized(
            f.field === "kind"
              ? [e.kind, kinds[e.kind]].join(" ")
              : Array.isArray(e[f.field])
                ? e[f.field].join(" ")
                : e[f.field],
          ).includes(f.value),
        ) && terms.every((t) => normalized(e.text).includes(t)),
    )
    .sort((a, b) => {
      const score = (e) =>
        terms.reduce(
          (s, t) =>
            s +
            (normalized(e.title) === t
              ? 20
              : normalized(e.title).includes(t)
                ? 5
                : 1),
          0,
        );
      return score(b) - score(a);
    });
}
export function related(entries, relations, key, { kind, limit = 3 } = {}) {
  const source = entries.find((e) => e.key === key);
  if (!source) return [];
  return entries
    .filter((e) => e.key !== key && (!kind || e.kind === kind))
    .map((e) => {
      const explicit = (relations.links || []).find(
        (r) =>
          (r.from === key && r.to === e.key) ||
          (r.bidirectional !== false && r.to === key && r.from === e.key),
      );
      const tags =
        relations.automaticTags === false
          ? []
          : e.tags.filter((t) => source.tags.includes(t));
      return {
        ...e,
        score: (explicit ? 100 : 0) + tags.length,
        reason: explicit?.note || tags.join(" · "),
      };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
