"use client";

import { useState } from "react";

import { API_BASE, checkBackendHealth, type HealthResponse } from "@/lib/api";


const idleMessage = {
  status: "idle",
  message: "点击按钮检查后端健康状态"
};


export default function HomePage() {
  const [response, setResponse] = useState<HealthResponse | typeof idleMessage>(idleMessage);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleHealthCheck = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const result = await checkBackendHealth();
      setResponse(result);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "请求失败，请确认后端服务和 CORS 配置是否正确。";
      setError(message);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Render + Vercel + Supabase Ready</p>
        <h1>AI Stock Research Platform</h1>
        <p className="lead">
          一个可直接接入 Supabase Postgres，并分别部署到 Render 与 Vercel 的全栈基础骨架。
        </p>

        <div className="actions">
          <button
            className="primary-button"
            type="button"
            onClick={handleHealthCheck}
            disabled={isChecking}
          >
            {isChecking ? "检查中..." : "检查后端健康"}
          </button>
          <p className="api-base">API Base: {API_BASE}</p>
        </div>

        <div className={`status-panel ${error ? "status-panel-error" : ""}`}>
          <p className="status-label">最近一次响应</p>
          <pre>{JSON.stringify(error ? { error } : response, null, 2)}</pre>
        </div>
      </section>
    </main>
  );
}
