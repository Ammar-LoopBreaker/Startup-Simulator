"""
Startup Simulator AI — Backend Stub
====================================
This is a lightweight FastAPI service that mirrors the contract used by the
frontend's client-side simulation engine (see /js/simulation.js). The UI
works fully standalone without this backend — it is provided so the project
matches the intended architecture (FastAPI + Celery + Redis + Postgres) and
so a real forecasting model (Prophet / scikit-learn / an LLM advisor via
LangChain) can be dropped in behind the same /api/simulate and
/api/recommendations endpoints later.

Run locally:
    pip install fastapi uvicorn pydantic
    uvicorn main:app --reload --port 8000

Then open http://localhost:8000/docs for interactive API docs.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

app = FastAPI(
    title="Startup Simulator AI — API",
    description="Digital twin simulation engine for startup validation.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

INDUSTRY_FACTORS = {
    "saas":        {"demand": 1.15, "competition": 0.75, "churn": 0.035, "cac": 90},
    "ecommerce":   {"demand": 1.30, "competition": 0.55, "churn": 0.06,  "cac": 45},
    "fintech":     {"demand": 1.05, "competition": 0.60, "churn": 0.025, "cac": 140},
    "healthtech":  {"demand": 0.95, "competition": 0.80, "churn": 0.02,  "cac": 180},
    "edtech":      {"demand": 1.10, "competition": 0.70, "churn": 0.05,  "cac": 60},
    "marketplace": {"demand": 1.20, "competition": 0.50, "churn": 0.045, "cac": 70},
    "other":       {"demand": 1.0,  "competition": 0.65, "churn": 0.04,  "cac": 85},
}


class StartupProfile(BaseModel):
    name: str = "Untitled Startup"
    industry: str = "saas"
    business_model: str = Field("subscription", alias="businessModel")
    price: float = 100
    team_size: int = Field(5, alias="teamSize")
    avg_salary: float = Field(6000, alias="avgSalary")
    office_expense: float = Field(2000, alias="officeExpense")
    cloud_cost: float = Field(1500, alias="cloudCost")
    marketing_budget: float = Field(6000, alias="marketingBudget")
    product_budget: float = Field(3000, alias="productBudget")
    support_cost: float = Field(1000, alias="supportCost")
    legal_cost: float = Field(700, alias="legalCost")
    funding_raised: float = Field(300000, alias="fundingRaised")
    launch_delay_months: int = Field(0, alias="launchDelayMonths")

    class Config:
        populate_by_name = True


class MonthRow(BaseModel):
    month: int
    customers: int
    revenue: float
    expenses: float
    profit: float
    cash: float


class SimulationResult(BaseModel):
    series: List[MonthRow]
    health_score: int
    risk_level: str
    break_even_month: Optional[int]
    runway_months: int
    final_revenue: float


def run_projection(p: StartupProfile, months: int = 24) -> SimulationResult:
    f = INDUSTRY_FACTORS.get(p.industry, INDUSTRY_FACTORS["other"])
    fixed = (p.team_size * p.avg_salary) + p.office_expense + p.cloud_cost + p.support_cost + p.legal_cost

    customers = 0
    cash = p.funding_raised
    series: List[MonthRow] = []
    break_even = None

    for m in range(1, months + 1):
        launched = m > p.launch_delay_months
        elasticity = max(0.35, 1 - ((p.price - 150) / 150) * 0.4)
        new_customers = round((p.marketing_budget / f["cac"]) * f["demand"] * f["competition"] * elasticity) if launched else 0
        churned = round(customers * f["churn"])
        customers = max(0, customers + new_customers - churned)

        revenue = round(customers * p.price) if launched else 0
        expenses = round(fixed + p.marketing_budget + (p.product_budget * (1 if m <= 6 else 0.6)))
        profit = revenue - expenses
        cash += profit

        if break_even is None and profit >= 0 and m > 1:
            break_even = m

        series.append(MonthRow(month=m, customers=customers, revenue=revenue, expenses=expenses, profit=profit, cash=cash))

    first6_burn = [abs(r.profit) for r in series[:6] if r.profit < 0]
    avg_burn = (sum(first6_burn) / 6) if first6_burn else 0
    runway = int(cash / avg_burn) if avg_burn > 0 else 99

    score = 50
    score += (22 - min(22, (break_even or 24) // 2)) if break_even else -10
    score += min(18, runway // 2)
    score += (f["demand"] - 1) * 20
    final_customers = series[-1].customers
    score += min(15, final_customers // 80)
    score = max(4, min(97, round(score)))

    risk = "Low" if score >= 70 else "Moderate" if score >= 45 else "High"

    return SimulationResult(
        series=series,
        health_score=score,
        risk_level=risk,
        break_even_month=break_even,
        runway_months=min(runway, 99),
        final_revenue=series[-1].revenue,
    )


@app.get("/")
def root():
    return {"service": "Startup Simulator AI", "status": "online", "docs": "/docs"}


@app.post("/api/simulate", response_model=SimulationResult)
def simulate(profile: StartupProfile):
    """Runs a 24-month AI business simulation for a given startup profile."""
    return run_projection(profile)


@app.post("/api/what-if", response_model=dict)
def what_if(profile: StartupProfile, price_change_pct: float = 0, hires: int = 0, marketing_multiplier: float = 1.0):
    """Applies a what-if scenario on top of a base profile and returns both forecasts."""
    base = run_projection(profile)

    scenario_profile = profile.copy()
    scenario_profile.price = profile.price * (1 + price_change_pct / 100)
    scenario_profile.team_size = max(1, profile.team_size + hires)
    scenario_profile.marketing_budget = profile.marketing_budget * marketing_multiplier

    scenario = run_projection(scenario_profile)
    return {"base": base, "scenario": scenario}


@app.get("/api/industries")
def industries():
    return {"industries": list(INDUSTRY_FACTORS.keys())}
