const COUNTRY_RULES = [
  { name: "香港", flag: "🇭🇰", codes: ["hk"], keywords: ["香港", "hk", "hong kong", "🇭🇰"] },
  { name: "台湾", flag: "🇹🇼", codes: ["tw"], keywords: ["台湾", "taiwan", "tw", "🇹🇼"] },
  { name: "新加坡", flag: "🇸🇬", codes: ["sg"], keywords: ["新加坡", "singapore", "sg", "🇸🇬"] },
  { name: "日本", flag: "🇯🇵", codes: ["jp"], keywords: ["日本", "tokyo", "japan", "jp", "🇯🇵"] },
  { name: "韩国", flag: "🇰🇷", codes: ["kr"], keywords: ["韩国", "首尔", "korea", "kr", "🇰🇷"] },
  { name: "美国", flag: "🇺🇸", codes: ["us"], keywords: ["美国", "united states", "us", "🇺🇸", "los angeles"] },
  { name: "英国", flag: "🇬🇧", codes: ["uk", "gb"], keywords: ["英国", "伦敦", "uk", "gb", "britain", "🇬🇧"] },
  { name: "德国", flag: "🇩🇪", codes: ["de"], keywords: ["德国", "germany", "de", "🇩🇪"] },
  { name: "法国", flag: "🇫🇷", codes: ["fr"], keywords: ["法国", "france", "fr", "🇫🇷"] },
  { name: "荷兰", flag: "🇳🇱", codes: ["nl"], keywords: ["荷兰", "netherlands", "nl", "🇳🇱"] },
  { name: "加拿大", flag: "🇨🇦", codes: ["ca"], keywords: ["加拿大", "canada", "ca", "🇨🇦"] },
  { name: "澳大利亚", flag: "🇦🇺", codes: ["au"], keywords: ["澳大利亚", "australia", "au", "🇦🇺"] },
  { name: "马来西亚", flag: "🇲🇾", codes: ["my"], keywords: ["马来西亚", "malaysia", "my", "🇲🇾"] },
  { name: "泰国", flag: "🇹🇭", codes: ["th"], keywords: ["泰国", "thailand", "th", "🇹🇭"] },
  { name: "菲律宾", flag: "🇵🇭", codes: ["ph"], keywords: ["菲律宾", "philippines", "ph", "🇵🇭"] },
  { name: "越南", flag: "🇻🇳", codes: ["vn"], keywords: ["越南", "vietnam", "vn", "🇻🇳"] },
  { name: "印尼", flag: "🇮🇩", codes: ["id"], keywords: ["印尼", "indonesia", "id", "🇮🇩"] },
  { name: "印度", flag: "🇮🇳", codes: ["in"], keywords: ["印度", "india", "in", "🇮🇳"] },
  { name: "俄罗斯", flag: "🇷🇺", codes: ["ru"], keywords: ["俄罗斯", "russia", "ru", "🇷🇺"] },
  { name: "其他地区", flag: "", codes: ["other"], keywords: [] }
];

const EMOJI_FLAG_PATTERN = /[\u{1F1E6}-\u{1F1FF}]{2}/u;

function includesKeyword(value, keyword) {
  return value.includes(keyword.toLowerCase());
}

export function detectCountryName(proxyName) {
  const value = proxyName.toLowerCase();
  for (const rule of COUNTRY_RULES) {
    if (rule.keywords.some((keyword) => includesKeyword(value, keyword))) {
      return rule.name;
    }
  }
  return "其他地区";
}

export function hasEmojiFlag(value) {
  return EMOJI_FLAG_PATTERN.test(value);
}

export function addCountryFlagToName(proxyName) {
  const name = String(proxyName || "").trim();
  if (!name || hasEmojiFlag(name)) {
    return name;
  }

  const countryName = detectCountryName(name);
  const rule = COUNTRY_RULES.find((item) => item.name === countryName);
  if (!rule?.flag) {
    return name;
  }

  return `${rule.flag} ${name}`;
}

export function resolveCountryByCode(code) {
  const normalized = code.toLowerCase();
  const rule = COUNTRY_RULES.find((item) => item.codes.includes(normalized));
  return rule ? rule.name : null;
}
