// components/RuleSidebar.tsx
import { type AutomataRule } from "../lib/rule30";

// Визначаємо пропси, які компонент буде приймати від app/page.tsx
interface RuleSidebarProps {
  currentRule: AutomataRule;
  onRuleChange: (rule: AutomataRule) => void;
}

const ruleData: { rule: AutomataRule; name: string; description: string }[] = [
  { 
    rule: 'R30', 
    name: 'Правило 30', 
    description: 'Хаотичний генератор, ідеальний для PRNG. Клас III.' 
  },
  { 
    rule: 'R22', 
    name: 'Правило 22', 
    description: 'Колапсуючий патерн. Не підходить для криптографії. Клас III.' 
  },
  // У майбутньому тут можна додати: R90, R110 та ін.
];

export default function RuleSidebar({ currentRule, onRuleChange }: RuleSidebarProps) {
  return (
    <div className="w-full h-full bg-gray-800 p-4 border-r border-gray-700 shadow-xl flex flex-col">
      <h2 className="text-xl font-semibold mb-6 text-blue-400">
        Вибір Правила (CA)
      </h2>
      
      <div className="space-y-4">
        {ruleData.map((item) => (
          <div 
            key={item.rule} 
            className={`p-3 rounded-lg cursor-pointer transition duration-150 ease-in-out ${
              currentRule === item.rule 
                ? 'bg-blue-600 border border-blue-400 shadow-lg' 
                : 'bg-gray-700 hover:bg-gray-600 border border-transparent'
            }`}
            onClick={() => onRuleChange(item.rule)}
          >
            <input
              type="radio"
              id={`rule-${item.rule}`}
              name="automata-rule"
              value={item.rule}
              checked={currentRule === item.rule}
              onChange={() => onRuleChange(item.rule)}
              className="hidden"
            />
            <label htmlFor={`rule-${item.rule}`} className="block">
              <span className="font-bold text-lg">{item.name}</span>
              <p className="text-xs text-gray-300 mt-1">{item.description}</p>
            </label>
          </div>
        ))}
      </div>
      
      <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-400">
        <p>Обране правило: <span className="font-mono text-white">{currentRule}</span></p>
      </div>
    </div>
  );
}