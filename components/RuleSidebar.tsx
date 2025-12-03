// components/RuleSidebar.tsx
import { useState, useEffect } from "react";

interface RuleSidebarProps {
  currentRule: string;
  onRuleChange: (rule: string) => void;
}

const ruleData = [
  { 
    rule: 'XOR-MIX', 
    name: 'Dual XOR (R30 + R86)'
  },
  { 
    rule: 'TRIPLE-MIX', 
    name: 'Triple XOR (30+86+101)'
  },
  { 
    rule: 'R30', name: 'Rule 30' 
  },
  { 
    rule: 'Custom', 
    name: 'Власна комбінація', 
    description: 'Введіть свої правила.' 
  },
];

export default function RuleSidebar({ currentRule, onRuleChange }: RuleSidebarProps) {
  // Локальний стан для кастомного поля
  const [customInput, setCustomInput] = useState("30 90 45");
  
  // Чи обрано зараз Custom?
  // Якщо currentRule не входить у список пресетів (окрім 'Custom'), значить це кастомний ввід
  const isCustomActive = currentRule === 'Custom' || !ruleData.some(r => r.rule === currentRule && r.rule !== 'Custom');

  const handleRadioChange = (ruleKey: string) => {
    if (ruleKey === 'Custom') {
        onRuleChange(customInput); // Відправляємо значення з інпуту
    } else {
        onRuleChange(ruleKey);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    // Одразу оновлюємо правило в батьківському компоненті
    onRuleChange(val);
  };

  return (
    <div className="w-full h-full bg-gray-800 p-4 border-r border-gray-700 shadow-xl flex flex-col overflow-y-auto">
      <h2 className="text-xl font-semibold mb-6 text-blue-400">
        Алгоритм
      </h2>
      
      <div className="space-y-3">
        {ruleData.map((item) => {
          const isActive = item.rule === 'Custom' ? isCustomActive : currentRule === item.rule;
          
          return (
            <div 
              key={item.rule} 
              className={`p-3 rounded-lg cursor-pointer transition duration-150 ease-in-out border ${
                isActive
                  ? 'bg-blue-900/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                  : 'bg-gray-700 hover:bg-gray-600 border-transparent'
              }`}
              onClick={() => handleRadioChange(item.rule)}
            >
              <div className="flex items-center mb-1">
                  <input
                    type="radio"
                    name="automata-rule"
                    checked={isActive}
                    onChange={() => handleRadioChange(item.rule)}
                    className="mr-3 w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 focus:ring-blue-500"
                  />
                  <span className={`font-bold ${isActive ? 'text-white' : 'text-gray-200'}`}>
                      {item.name}
                  </span>
              </div>
              <p className="text-xs text-gray-400 ml-7 leading-relaxed">
                  {item.description}
              </p>

              {/* Поле вводу з'являється тільки всередині Custom картки, якщо вона активна */}
              {item.rule === 'Custom' && isActive && (
                <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-2 duration-200">
                    <input 
                        type="text" 
                        value={customInput}
                        onChange={handleCustomInputChange}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-sm text-white font-mono focus:border-blue-400 outline-none placeholder-gray-600"
                        placeholder="Напр: 30 86 101"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                        Через пробіл (0-255). Кількість = шари XOR.
                    </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-500">
        <p>Active Config: <span className="font-mono text-blue-300 block truncate">{currentRule}</span></p>
      </div>
    </div>
  );
}