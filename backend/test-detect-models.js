require("dotenv").config();

const REQUEST_TIMEOUT_MS = 20000;

function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message || JSON.stringify(error);
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const bodyText = await response.text();
    let bodyJson = null;

    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      bodyJson = null;
    }

    if (!response.ok) {
      const errorMessage =
        bodyJson?.error?.message ||
        bodyJson?.message ||
        bodyText ||
        `${response.status} ${response.statusText}`;

      throw new Error(errorMessage);
    }

    return bodyJson;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeModelList(rawList, mapper) {
  const names = (rawList || [])
    .map(mapper)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return [...new Set(names)];
}

async function detectOpenAIModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      provider: "openai",
      ok: false,
      reason: "OPENAI_API_KEY tidak ditemukan",
    };
  }

  try {
    const data = await requestJson("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const models = normalizeModelList(data?.data, (item) => item?.id);

    return {
      provider: "openai",
      ok: true,
      modelCount: models.length,
      models,
      configuredModel: process.env.OPENAI_MODEL || null,
    };
  } catch (error) {
    return {
      provider: "openai",
      ok: false,
      reason: formatError(error),
      configuredModel: process.env.OPENAI_MODEL || null,
    };
  }
}

async function detectDeepSeekModels() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      provider: "deepseek",
      ok: false,
      reason: "DEEPSEEK_API_KEY tidak ditemukan",
    };
  }

  const endpoints = [
    "https://api.deepseek.com/models",
    "https://api.deepseek.com/v1/models",
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await requestJson(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const models = normalizeModelList(
        data?.data,
        (item) => item?.id || item?.model,
      );

      return {
        provider: "deepseek",
        ok: true,
        endpoint,
        modelCount: models.length,
        models,
        configuredModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      };
    } catch (error) {
      if (endpoint === endpoints[endpoints.length - 1]) {
        return {
          provider: "deepseek",
          ok: false,
          reason: formatError(error),
          configuredModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        };
      }
    }
  }

  return {
    provider: "deepseek",
    ok: false,
    reason: "Tidak ada endpoint DeepSeek yang berhasil diakses",
    configuredModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  };
}

async function detectGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      provider: "gemini",
      ok: false,
      reason: "GEMINI_API_KEY tidak ditemukan",
    };
  }

  try {
    const data = await requestJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {
        method: "GET",
      },
    );

    const models = normalizeModelList(
      data?.models,
      (item) => item?.name || item?.displayName,
    );

    return {
      provider: "gemini",
      ok: true,
      modelCount: models.length,
      models,
      configuredModel: "gemini-2.5-flash-lite",
    };
  } catch (error) {
    return {
      provider: "gemini",
      ok: false,
      reason: formatError(error),
      configuredModel: "gemini-2.5-flash-lite",
    };
  }
}

function printResult(result) {
  const status = result.ok ? "OK" : "FAILED";
  console.log(`\n[${result.provider.toUpperCase()}] ${status}`);

  if (result.configuredModel) {
    console.log(`Configured model: ${result.configuredModel}`);
  }

  if (result.ok) {
    console.log(`Total models detected: ${result.modelCount}`);
    const preview = result.models.slice(0, 15);
    preview.forEach((modelName) => console.log(`- ${modelName}`));

    if (result.models.length > preview.length) {
      console.log(
        `... dan ${result.models.length - preview.length} model lainnya`,
      );
    }

    if (result.endpoint) {
      console.log(`Endpoint: ${result.endpoint}`);
    }
  } else {
    console.log(`Reason: ${result.reason}`);
  }
}

async function main() {
  console.log("Deteksi model API OpenAI, DeepSeek, dan Gemini...");

  const results = await Promise.all([
    detectOpenAIModels(),
    detectDeepSeekModels(),
    detectGeminiModels(),
  ]);

  results.forEach(printResult);

  const okCount = results.filter((item) => item.ok).length;
  const allCount = results.length;
  console.log(`\nSelesai. ${okCount}/${allCount} provider berhasil dideteksi.`);

  if (okCount < allCount) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "\nTerjadi error saat menjalankan deteksi model:",
    formatError(error),
  );
  process.exit(1);
});
