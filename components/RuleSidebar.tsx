// components/RuleSidebar.tsx
import { type AutomataRule } from "../lib/rule30";

interface RuleSidebarProps {
  currentRule: AutomataRule;
  onRuleChange: (rule: AutomataRule) => void;
}

const ruleData: { rule: AutomataRule; name: string; description: string; color: string }[] = [
  { 
    rule: 'R30', 
    name: 'Rule 30', 
    description: 'Стандарт хаосу (Class III). Використовується в Mathematica.',
    color: 'bg-blue-600'
  },
  { 
    rule: 'R45', 
    name: 'Rule 45', 
    description: 'Агресивний хаос (Class III). Сильний лавинний ефект.',
    color: 'bg-red-600'
  },
  { 
    rule: 'R110', 
    name: 'Rule 110', 
    description: 'Тьюрінг-повне (Class IV). Складна поведінка на межі хаосу.',
    color: 'bg-purple-600'
  },
  { 
    rule: 'R90', 
    name: 'Rule 90', 
    description: '⚠️ Тільки для навчання. Генерує фрактал Серпінського. Лінійне.',
    color: 'bg-yellow-600'
  },
  { 
    rule: 'Hybrid', 
    name: 'Hybrid A (30+110)', 
    description: 'Максимальний захист. Баланс хаосу та структури.',
    color: 'bg-green-600'
  },
  { 
    rule: 'HybridFast', 
    name: 'Hybrid B (90+45)', 
    description: 'Швидкісний режим. Поєднання фрактального розсіювання та хаосу.',
    color: 'bg-teal-600'
  },
];

export default function RuleSidebar({ currentRule, onRuleChange }: RuleSidebarProps) {
  return (
    <div className="w-full h-full bg-gray-900 p-4 border-r border-gray-700 flex flex-col overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 text-gray-100 pl-2 border-l-4 border-blue-500">
        Алгоритми CA
      </h2>
      
      <div className="space-y-3 pb-4">
        {ruleData.map((item) => (
          <div 
            key={item.rule} 
            className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
              currentRule === item.rule 
                ? `${item.color} border-transparent shadow-lg transform scale-[1.02]` 
                : 'bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-gray-500'
            }`}
            onClick={() => onRuleChange(item.rule)}
          >
            <input
              type="radio"
              name="automata-rule"
              value={item.rule}
              checked={currentRule === item.rule}
              onChange={() => onRuleChange(item.rule)}
              className="hidden"
            />
            <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-base text-white">{item.name}</span>
                {currentRule === item.rule && (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                )}
            </div>
            <p className="text-xs text-gray-300 leading-relaxed opacity-90">{item.description}</p>
          </div>
        ))}
      </div>
      
      <div className="mt-auto pt-4 border-t border-gray-800">
         <div className="p-3 bg-gray-800/50 rounded-lg text-center">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Активний алгоритм</p>
            <p className="font-mono text-blue-300 text-sm font-bold">{currentRule}</p>
         </div>
      </div>
    </div>
  );
}