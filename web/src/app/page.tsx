"use client";

import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { BotIcon, UsersIcon, RecurringIcon, ChartIcon, LockIcon, MonitorIcon } from "@/components/feature-icons";
import { BrandMark } from "@/components/brand-mark";

/* ─── MCP Client Icons (placeholder removed) ─── */

function ClientIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const clients = [
  { name: "OpenClaw", desc: "开源 MCP 客户端", icon: ClientIcon },
  { name: "Hermes Agent", desc: "AI Agent MCP 客户端", icon: ClientIcon },
  { name: "Claude Desktop", desc: "Anthropic 桌面应用", icon: ClientIcon },
  { name: "Cursor", desc: "AI 代码编辑器", icon: ClientIcon },
  { name: "Continue.dev", desc: "开源 AI 助手", icon: ClientIcon },
  { name: "…更多客户端", desc: "任意支持 stdio MCP 的应用", icon: ClientIcon },
];

const features = [
  { icon: BotIcon, title: "一句话记账", desc: "「午饭吃了 35 块」「给猫买粮 200」，通过任意 MCP 客户端一句话完成记录。" },
  { icon: UsersIcon, title: "多对象追踪", desc: "按个人、伴侣、宠物、项目等对象分别记账，收支清晰分账。" },
  { icon: RecurringIcon, title: "长期分摊", desc: "猫粮分 60 天、订阅分 30 天……自动平摊到每日，消费更真实。" },
  { icon: ChartIcon, title: "数据分析", desc: "分类汇总、周期对比、趋势图表，随时掌握支出结构。" },
  { icon: LockIcon, title: "本地存储", desc: "所有数据存于本地 SQLite，无需注册账号，无需联网，隐私无忧。" },
  { icon: MonitorIcon, title: "桌面端 + MCP", desc: "Electron 桌面应用自带 MCP 服务，浏览器端也可独立使用。" },
];

export default function Home() {
  return (
    <div className="pb-14 lg:pb-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[40px] bg-[linear-gradient(160deg,var(--surface-strong),var(--surface-soft))] px-5 py-10 lg:px-10 lg:py-16">
        <div className="relative z-10 mx-auto max-w-[900px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/80 px-4 py-2 text-sm font-medium backdrop-blur">
            <BrandMark className="h-5 w-5" title="Billbook 标识" />
            AI 智能记账 · 标准 MCP 服务
            <span className="ml-1 rounded-full bg-[color:var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
              v2.41
            </span>
          </div>

          <h1 className="mt-8 font-display text-[clamp(42px,7vw,76px)] font-semibold leading-[1.04] tracking-[-0.04em]">
            AI 智能记账
            <br />
            <span className="text-[color:var(--accent)]">一句话搞定</span>
          </h1>

          <p className="mt-6 mx-auto max-w-[560px] text-base leading-8 text-[color:var(--muted)] lg:text-lg">
            通过标准 MCP 协议，支持 <strong>OpenClaw</strong>、<strong>Hermes Agent</strong> 等任意 MCP 客户端一句话记账。
            消费对象追踪、长期分摊、本地存储，隐私安全。
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={siteConfig.githubUrl}
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] hover:bg-white hover:text-[color:var(--accent)] border border-transparent hover:border-[color:var(--accent)] px-6 py-3 text-white text-[15px] font-semibold transition-colors duration-300"
            >
              下载 GitHub
            </a>
            <Link
              href="/mcp-guide"
              className="inline-flex items-center gap-2 rounded-full bg-white text-[color:var(--foreground)] border border-[color:var(--line)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] px-6 py-3 text-[15px] font-semibold transition-colors duration-300"
            >
              MCP 记账教程 →
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: "对象化", valueEn: "Object-based", key: "消费模型", desc: "按对象追踪" },
              { value: "本地优先", valueEn: "Local-first", key: "数据存储", desc: "SQLite 本地" },
              { value: "AI 驱动", valueEn: "AI-powered", key: "智能录入", desc: "MCP 一句话" },
              { value: "桌面端", valueEn: "Desktop", key: "运行平台", desc: "Electron + Web" },
            ].map((stat) => (
              <div key={stat.key} className="rounded-2xl bg-white/60 p-4 backdrop-blur text-center transition duration-300 hover:bg-white/80 hover:shadow-[0px_2px_8px_rgba(0,0,0,0.03)]">
                <p className="font-display text-2xl font-semibold">{stat.value}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(21,95,83,0.12),transparent_70%)] blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(21,95,83,0.08),transparent_70%)] blur-3xl" />
      </section>

      {/* Supported MCP Clients */}
      <section className="mt-6">
        <div className="mb-8 text-center">
          <p className="type-kicker">MCP Clients</p>
          <h2 className="type-section-title mt-2 tracking-[-0.02em]">兼容的 MCP 客户端</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {clients.map((c) => (
            <div
              key={c.name}
              className="panel rounded-[24px] p-5 text-center transition duration-300 hover:-translate-y-0.5 hover:shadow-[0px_8px_32px_rgba(0,0,0,0.04)]"
            >
              <div className="mx-auto text-[color:var(--accent)]">
                <c.icon />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{c.name}</h3>
              <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MCP Tutorial Banner */}
      <section className="mt-6 rounded-[28px] border border-[color:var(--accent-soft)] bg-[linear-gradient(135deg,var(--accent-soft),var(--surface-soft))] p-6 lg:p-8">
        <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:text-left lg:justify-between">
          <div>
            <p className="type-kicker text-[color:var(--accent)]">📖 Tutorial</p>
            <h3 className="mt-1 text-lg font-semibold">MCP 记账配置教程</h3>
            <p className="mt-1 text-sm text-[color:var(--muted)] max-w-[500px]">
              手把手教你在 OpenClaw、Hermes Agent、Claude Desktop 等客户端中配置 Billbook MCP 服务，一句话开始记账。
            </p>
          </div>
          <Link
            href="/mcp-guide"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[color:var(--accent)] hover:bg-white hover:text-[color:var(--accent)] border border-transparent hover:border-[color:var(--accent)] px-6 py-3 text-white text-[15px] font-semibold transition-colors duration-300"
          >
            查看完整教程 →
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mt-6">
        <div className="mb-8 text-center">
          <p className="type-kicker">Features</p>
          <h2 className="type-section-title mt-2 tracking-[-0.02em]">为什么选择 Billbook？</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="panel rounded-[28px] p-5 lg:p-6 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0px_8px_32px_rgba(0,0,0,0.04),0px_4px_12px_rgba(0,0,0,0.02)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mt-6 panel panel-strong overflow-hidden rounded-[36px] p-5 lg:p-8">
        <p className="type-kicker text-center">How it works</p>
        <h2 className="type-section-title mt-2 text-center tracking-[-0.02em]">三步开始 AI 记账</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {[
            { step: "01", title: "安装配置 MCP", desc: "克隆仓库、安装依赖，在 OpenClaw、Hermes 或任意 MCP 客户端中配置 billbook 服务。" },
            { step: "02", title: "创建消费对象", desc: "设置「我自己」「宠物」「项目」等消费对象，为每个对象配置分类和预算。" },
            { step: "03", title: "一句话记账", desc: "打开你的 MCP 客户端，说「午饭吃了 35 块」，账单自动生成！" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-xl font-semibold text-white">
                {s.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/mcp-guide"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-strong)] hover:bg-[color:var(--accent)] hover:text-white hover:border-transparent px-6 py-3 text-[15px] font-semibold transition-colors duration-300"
          >
            查看详细 MCP 教程 →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-6 rounded-[36px] bg-[color:var(--accent)] p-8 text-center text-white lg:p-12">
        <h2 className="font-display text-[clamp(32px,5vw,48px)] font-semibold leading-tight tracking-[-0.02em]">
          开始你的 AI 记账之旅
        </h2>
        <p className="mt-4 mx-auto max-w-[520px] text-base leading-8 text-white/90">
          开源免费，数据本地存储，支持 OpenClaw、Hermes Agent 等 MCP 客户端。现在就试试吧！
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={siteConfig.githubUrl}
            className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-transparent hover:text-white border border-transparent hover:border-white/40 px-6 py-3 text-[15px] font-semibold text-[color:var(--accent)] transition-colors duration-300"
          >
            下载 GitHub
          </a>
          <Link
            href="/mcp-guide"
            className="inline-flex items-center gap-2 rounded-full border border-white/40 hover:bg-white hover:text-[color:var(--accent)] px-6 py-3 text-[15px] font-semibold transition-colors duration-300"
          >
            MCP 记账教程 →
          </Link>
        </div>
      </section>
    </div>
  );
}
