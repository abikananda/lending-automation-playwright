export interface RuleUiOptions {
  repeated: boolean;
  lowHighRisk: boolean;
  business: boolean;
}

export class LendingRuleService {
  getUiOptions(rule: string): RuleUiOptions {
    return {
      repeated: /repeated/i.test(rule),
      lowHighRisk: /low|medium|high.?risk/i.test(rule),
      business: /business/i.test(rule),
    };
  }

  getRuleOrder(rules: string[]): string[] {
    // Preserve backend-provided order. The old Selenium runner executed rules sequentially.
    return rules.map((rule) => rule.trim()).filter(Boolean);
  }
}
