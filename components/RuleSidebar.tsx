// components/RuleSidebar.tsx
import { type AutomataRule } from "../lib/rule30";

interface RuleSidebarProps {
  currentRule: AutomataRule;
  onRuleChange: (rule: AutomataRule) => void;
}

interface RuleMeta {
    rule: AutomataRule;
    name: string;
    desc: string;
    security: 1 | 2 | 3; // 1=Weak, 2=Standard, 3=Strong
    category: "Recommended" | "Experimental" | "Comparison (Weak)";
}

const rules: RuleMeta[] = [
  // RECOMMENDED
  { rule: 'R30', name: 'Rule 30', desc: 'Standard Chaos (Class 3).', security: 2, category: 'Recommended' },
  { rule: 'R45', name: 'Rule 45', desc: 'High Diffusion Chaos.', security: 3, category: 'Recommended' },
  { rule: 'Hybrid30_45', name: 'Hybrid A (30+45)', desc: 'Twin Chaos. High Entropy.', security: 3, category: 'Recommended' },
  
  // EXPERIMENTAL
  { rule: 'HybridTriad', name: 'Hybrid Triad', desc: 'Cycle 30 -> 86 -> 135.', security: 2, category: 'Experimental' },
  { rule: '2D_Life', name: '2D Game of Life', desc: 'Grid sampling. High latency.', security: 1, category: 'Experimental' },

  // COMPARISON
  { rule: 'R90', name: 'Rule 90', desc: 'Linear Fractal. For analysis only.', security: 1, category: 'Comparison (Weak)' },
  { rule: 'R110', name: 'Rule 110', desc: 'Complex (Biased). For analysis only.', security: 1, category: 'Comparison (Weak)' },
];

export default function RuleSidebar({ currentRule, onRuleChange }: RuleSidebarProps) {
  const categories = Array.from(new Set(rules.map(r => r.category)));

  const getSecurityColor = (level: number) => {
      if (level === 1) return "bg-red-500/20 text-red-400 border-red-500/30";
      if (level === 2) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      return "bg-green-500/20 text-green-400 border-green-500/30";
  };

  const getSecurityLabel = (level: number) => {
      if (level === 1) return "Weak";
      if (level === 2) return "Standard";
      return "Strong";
  };

  return (
    <div className="w-full h-full bg-gray-900 border-r border-gray-700 flex flex-col overflow-y-auto">
      <div className="p-6 border-b border-gray-700 bg-gray-900 sticky top-0 z-10">
        <h2 className="text-xl font-bold text-white tracking-tight">
          CA Algorithm
        </h2>
        <p className="text-xs text-gray-400 mt-1">Select generator rule</p>
      </div>
      
      <div className="flex-grow p-4 space-y-6">
        {categories.map(cat => (
            <div key={cat}>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">{cat}</h3>
                <div className="space-y-2">
                    {rules.filter(r => r.category === cat).map((item) => (
                        <div 
                            key={item.rule} 
                            onClick={() => onRuleChange(item.rule)}
                            className={`group p-3 rounded-lg cursor-pointer border transition-all duration-200 relative overflow-hidden ${
                                currentRule === item.rule 
                                ? 'bg-gray-800 border-blue-500 shadow-lg' 
                                : 'bg-transparent border-transparent hover:bg-gray-800/50 hover:border-gray-700'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-medium text-sm ${currentRule === item.rule ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                    {item.name}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getSecurityColor(item.security)}`}>
                                    {getSecurityLabel(item.security)}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 group-hover:text-gray-400 leading-snug pr-1">
                                {item.desc}
                            </p>
                            {currentRule === item.rule && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg"></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}