const SimEngine = (() => {

  const INDUSTRY_FACTORS = {
    saas:        { demand: 1.15, competition: 0.75, churn: 0.035, cac: 90  },
    ecommerce:   { demand: 1.30, competition: 0.55, churn: 0.06,  cac: 45  },
    fintech:     { demand: 1.05, competition: 0.60, churn: 0.025, cac: 140 },
    healthtech:  { demand: 0.95, competition: 0.80, churn: 0.02,  cac: 180 },
    edtech:      { demand: 1.10, competition: 0.70, churn: 0.05,  cac: 60  },
    marketplace: { demand: 1.20, competition: 0.50, churn: 0.045, cac: 70  },
    other:       { demand: 1.0,  competition: 0.65, churn: 0.04,  cac: 85  }
  };

  const MODEL_ROUND = 3300; // notional "training data size" flavor text, cosmetic only

  function defaultProfile(){
    return {
      name: "Nimbus Freight",
      idea: "AI-optimized route planning for regional freight carriers",
      industry: "saas",
      country: "United States",
      businessModel: "subscription",
      price: 149,
      customerSegment: "smb",
      teamSize: 8,
      avgSalary: 6200,
      officeExpense: 2200,
      cloudCost: 1800,
      marketingBudget: 9000,
      productBudget: 4000,
      supportCost: 1500,
      legalCost: 900,
      fundingRaised: 450000,
      launchDelayMonths: 0
    };
  }

  /**
   * Runs a 24-month projection for a given profile + optional
   * what-if deltas. Returns month-by-month series plus derived
   * scores. Pure function — no mutation, no randomness — so the
   * same inputs always produce the same forecast.
   */
  function project(profile, months = 24){
    const f = INDUSTRY_FACTORS[profile.industry] || INDUSTRY_FACTORS.other;

    const monthlyExpenseFixed =
      (profile.teamSize * profile.avgSalary) +
      profile.officeExpense + profile.cloudCost +
      profile.supportCost + profile.legalCost;

    const marketing = profile.marketingBudget * (profile.businessModel === 'one-time' ? 1.15 : 1);
    const priceAdj = profile.price;

    let customers = 0;
    let cash = profile.fundingRaised;
    const series = [];
    let breakEvenMonth = null;

    for (let m = 1; m <= months; m++){
      // pre-launch delay: no revenue, only burn, during delay window
      const launched = m > profile.launchDelayMonths;

      // new customers acquired this month, driven by marketing spend, industry demand,
      // dampened by competition and by price relative to a $150 anchor
      const priceElasticity = Math.max(0.35, 1 - ((priceAdj - 150) / 150) * 0.4);
      const newCustomers = launched
        ? Math.max(0, Math.round((marketing / f.cac) * f.demand * f.competition * priceElasticity))
        : 0;

      const churned = Math.round(customers * f.churn);
      customers = Math.max(0, customers + newCustomers - churned);

      const revenue = launched ? Math.round(customers * priceAdj * (profile.businessModel === 'one-time' ? 0.18 : 1)) : 0;
      const expenses = Math.round(monthlyExpenseFixed + marketing + (profile.productBudget * (m <= 6 ? 1 : 0.6)));
      const profit = revenue - expenses;
      cash = cash + profit;

      if (breakEvenMonth === null && profit >= 0 && m > 1) breakEvenMonth = m;

      series.push({
        month: m, customers, newCustomers, churned,
        revenue, expenses, profit, cash,
        burnRate: profit < 0 ? Math.abs(profit) : 0
      });
    }

    const last = series[series.length - 1];
    const first6 = series.slice(0,6);
    const avgBurn = first6.reduce((s,r)=> s + r.burnRate, 0) / 6;
    const runwayMonths = avgBurn > 0 ? Math.round(cash > 0 ? cash / avgBurn : cash / avgBurn) : Infinity;

    const marketingROI = profile.marketingBudget > 0
      ? Math.round(((last.revenue - profile.marketingBudget) / profile.marketingBudget) * 100)
      : 0;

    const healthScore = computeHealthScore({ profile, series, breakEvenMonth, runwayMonths, f });
    const riskLevel = healthScore >= 70 ? 'Low' : healthScore >= 45 ? 'Moderate' : 'High';

    return {
      profile, series, f,
      totals: {
        finalCustomers: last.customers,
        finalRevenue: last.revenue,
        finalExpenses: last.expenses,
        finalCash: last.cash,
        avgBurn: Math.round(avgBurn),
        runwayMonths: isFinite(runwayMonths) ? runwayMonths : 99,
        breakEvenMonth,
        marketingROI,
        healthScore,
        riskLevel
      }
    };
  }

  function computeHealthScore({ profile, series, breakEvenMonth, runwayMonths, f }){
    let score = 50;
    score += breakEvenMonth ? Math.max(0, 22 - Math.floor(breakEvenMonth/2)) : -10;
    score += Math.min(18, Math.round(runwayMonths / 2));
    score += (f.demand - 1) * 20;
    score += (f.competition - 0.65) * 15;
    score -= Math.max(0, (profile.price - 400) / 40);
    const finalCustomers = series[series.length-1].customers;
    score += Math.min(15, Math.round(finalCustomers / 80));
    return Math.max(4, Math.min(97, Math.round(score)));
  }

  /**
   * Applies a What-If scenario on top of a base profile and
   * returns { base, scenario } projections for side-by-side
   * comparison.
   */
  function whatIf(baseProfile, deltas){
    const base = project(baseProfile);
    const scenarioProfile = { ...baseProfile };

    if (deltas.priceChangePct) scenarioProfile.price = Math.round(baseProfile.price * (1 + deltas.priceChangePct/100));
    if (deltas.hires) scenarioProfile.teamSize = Math.max(1, baseProfile.teamSize + deltas.hires);
    if (deltas.marketingMultiplier) scenarioProfile.marketingBudget = Math.round(baseProfile.marketingBudget * deltas.marketingMultiplier);
    if (deltas.launchDelayMonths !== undefined) scenarioProfile.launchDelayMonths = deltas.launchDelayMonths;
    if (deltas.businessModel) scenarioProfile.businessModel = deltas.businessModel;
    if (deltas.expansion) scenarioProfile.marketingBudget = Math.round(scenarioProfile.marketingBudget * 1.4);

    const scenario = project(scenarioProfile);
    return { base, scenario };
  }

  /**
   * Generates plain-language AI Advisor recommendations from a
   * projection result. Rule-based stand-in for the LangChain +
   * LLM advisor layer.
   */
  function recommendations(result){
    const { totals, profile, f } = result;
    const recs = [];

    if (totals.runwayMonths < 9){
      recs.push({ tone:'bad', title:'Runway is tight', body:`At the current burn rate, cash covers roughly ${totals.runwayMonths} months. Consider trimming non-essential spend or opening a bridge round before month ${Math.max(1,totals.runwayMonths-2)}.` });
    } else {
      recs.push({ tone:'good', title:'Runway looks healthy', body:`Current funding supports about ${totals.runwayMonths} months of operation at this burn rate, giving room to hit milestones before the next raise.` });
    }

    if (totals.breakEvenMonth){
      recs.push({ tone: totals.breakEvenMonth <= 12 ? 'good' : 'warn', title:`Break-even projected at month ${totals.breakEvenMonth}`, body: totals.breakEvenMonth <= 12 ? 'That is ahead of the typical 12–18 month benchmark for this stage.' : 'Consider raising price 10–15% or reducing acquisition cost to pull break-even earlier.' });
    } else {
      recs.push({ tone:'bad', title:'No break-even in forecast window', body:'Expenses continue to outpace revenue through month 24. Revisit pricing, team size, or marketing efficiency.' });
    }

    if (totals.marketingROI < 0){
      recs.push({ tone:'warn', title:'Marketing ROI is negative', body:'Acquisition spend is not yet paying back within the window. Test a lower-CAC channel or tighten targeting before scaling budget further.' });
    } else {
      recs.push({ tone:'good', title:`Marketing ROI at ${totals.marketingROI}%`, body:'Spend is converting efficiently — this is a reasonable channel to scale incrementally.' });
    }

    if (profile.price < 80 && f && f.cac > 100){
      recs.push({ tone:'warn', title:'Price may be under-optimized', body:'Acquisition cost is high relative to price in this industry. A price increase of 10–20% is unlikely to significantly slow growth and would improve margin.' });
    }

    if (profile.teamSize > 15 && totals.finalRevenue < profile.teamSize * profile.avgSalary){
      recs.push({ tone:'warn', title:'Headcount ahead of revenue', body:'Team cost is outpacing revenue generation. Prioritize hires directly tied to revenue or retention before expanding further.' });
    }

    return recs;
  }

  function fmtMoney(n){
    const sign = n < 0 ? '-' : '';
    n = Math.abs(Math.round(n));
    if (n >= 1000000) return sign + '$' + (n/1000000).toFixed(2) + 'M';
    if (n >= 1000) return sign + '$' + (n/1000).toFixed(1) + 'K';
    return sign + '$' + n;
  }

  return { INDUSTRY_FACTORS, defaultProfile, project, whatIf, recommendations, fmtMoney, MODEL_ROUND };
})();

// ---- shared profile persistence (localStorage) ----
const ProfileStore = {
  KEY: 'ssai_profile_v1',
  load(){
    try{
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : SimEngine.defaultProfile();
    }catch(e){ return SimEngine.defaultProfile(); }
  },
  save(profile){
    try{ localStorage.setItem(this.KEY, JSON.stringify(profile)); }catch(e){}
  },
  reset(){
    try{ localStorage.removeItem(this.KEY); }catch(e){}
  }
};
