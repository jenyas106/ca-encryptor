import { useState } from "react";

interface RuleSidebarProps {
  currentRule: string;
  onRuleChange: (rule: string) => void;
}

// Тип для статусу проходження тестів
type NistStatus = 'perfect' | 'good' | 'average';

interface RuleItem {
  rule: string;
  name: string;
  nistStatus?: NistStatus;
}

const ruleData: RuleItem[] = [
  // --- ІДЕАЛЬНІ КОМБІНАЦІЇ ---
  { 
    rule: '86 75', 
    name: 'Rules 86 + 75', 
    nistStatus: 'perfect'
  },
  { 
    rule: '30 86 75', 
    name: 'Rules 30 + 86 + 75', 
    nistStatus: 'perfect'
  },
  { 
    rule: '86 75 106', 
    name: 'Rules 86 + 75 + 106', 
    nistStatus: 'perfect'
  },

  // --- ХОРОШІ (АЛЕ НЕ ІДЕАЛЬНІ) ---
  { 
    rule: '30 86', 
    name: 'Rules 30 + 86', 
    nistStatus: 'good'
  },
  { 
    rule: '75 30 86', 
    name: 'Rules 75 + 30 + 86', 
    nistStatus: 'good'
  },
  
  // --- З НЮАНСАМИ ---
  { 
    rule: '86 75 110', 
    name: 'Rules 86 + 75 + 110', 
    nistStatus: 'average'
  },
  { 
    rule: '86 75 45', 
    name: 'Rules 86 + 75 + 45', 
    nistStatus: 'average'
  },

  // --- КОНСТРУКТОР ---
  { 
    rule: 'Custom', 
    name: 'Власна комбінація', 
  },
];

export default function RuleSidebar({ currentRule, onRuleChange }: RuleSidebarProps) {
  const [customInput, setCustomInput] = useState("30 90 45");
  
  const isCustomActive = currentRule === 'Custom' || !ruleData.some(r => r.rule === currentRule);

  const handleRadioChange = (ruleKey: string) => {
    if (ruleKey === 'Custom') {
        onRuleChange(customInput);
    } else {
        onRuleChange(ruleKey);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    onRuleChange(val);
  };

  const renderStatusBadge = (status?: NistStatus) => {
      if (!status) return null;
      
      let colorClass = "";
      let text = "";

      switch (status) {
          case 'perfect':
              colorClass = "bg-green-500/20 text-green-400 border-green-500/50";
              text = "NIST: 100%";
              break;
          case 'good':
              colorClass = "bg-blue-500/20 text-blue-400 border-blue-500/50";
              text = "NIST: 99%";
              break;
          case 'average':
              colorClass = "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
              text = "NIST: ~95%";
              break;
      }

      return (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${colorClass} ml-auto`}>
              {text}
          </span>
      );
  };

  return (
    <div className="w-full h-full bg-gray-800 p-4 border-r border-gray-700 shadow-xl flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
      <h2 className="text-xl font-semibold mb-6 text-blue-400">
        Конфігурація (XOR)
      </h2>
      
      <div className="space-y-3 pb-4">
        {ruleData.map((item) => {
          const isActive = item.rule === 'Custom' ? isCustomActive : currentRule === item.rule;
          
          return (
            <div 
              key={item.rule} 
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ease-in-out border ${
                isActive
                  ? 'bg-blue-900/30 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                  : 'bg-gray-700/50 hover:bg-gray-700 border-transparent hover:border-gray-600'
              }`}
              onClick={() => handleRadioChange(item.rule)}
            >
              <div className="flex items-center mb-1 w-full h-full">
                  <input
                    type="radio"
                    name="automata-rule"
                    checked={isActive}
                    onChange={() => handleRadioChange(item.rule)}
                    className="mr-3 w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 focus:ring-blue-500"
                  />
                  <span className={`font-bold text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>
                      {item.name}
                  </span>
                  
                  {renderStatusBadge(item.nistStatus)}
              </div>
              
              {/* Поле для Custom вводу */}
              {item.rule === 'Custom' && isActive && (
                <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1 duration-200">
                    <input 
                        type="text" 
                        value={customInput}
                        onChange={handleCustomInputChange}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded text-sm text-white font-mono focus:border-blue-400 outline-none placeholder-gray-600"
                        placeholder="Напр: 30 86 101"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                        Введіть числа від 0 до 255 через пробіл.
                    </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-500">
        <p>Active: <span className="font-mono text-blue-300 block truncate">{currentRule}</span></p>
      </div>
    </div>
  );
}