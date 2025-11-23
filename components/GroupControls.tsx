import React, { useState, useEffect } from 'react';
import { FileDigit } from 'lucide-react';

interface GroupControlsProps {
  totalPages: number;
  onPageGroupChange: (pagesPerGroup: number) => void;
}

const GroupControls: React.FC<GroupControlsProps> = ({ totalPages, onPageGroupChange }) => {
  const [pagesPerGroup, setPagesPerGroup] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>('1');

  // Update the parent when pagesPerGroup changes
  useEffect(() => {
    onPageGroupChange(pagesPerGroup);
  }, [pagesPerGroup, onPageGroupChange]);

  // Handle input changes with validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Allow empty input (for backspace/delete)
    if (value === '') {
      return;
    }

    const numValue = parseInt(value);

    // Validate and set value
    if (!isNaN(numValue) && numValue > 0 && numValue <= totalPages) {
      setPagesPerGroup(numValue);
    } else if (!isNaN(numValue) && numValue > totalPages) {
      // If value is too large, set to max
      setPagesPerGroup(totalPages);
    }
  };

  // Handle blur event to ensure we have a valid value
  const handleInputBlur = () => {
    if (inputValue === '') {
      setInputValue('1');
      setPagesPerGroup(1);
    } else {
      const numValue = parseInt(inputValue);
      if (isNaN(numValue) || numValue <= 0) {
        setInputValue('1');
        setPagesPerGroup(1);
      } else if (numValue > totalPages) {
        setInputValue(totalPages.toString());
        setPagesPerGroup(totalPages);
      }
    }
  };

  // Calculate number of groups
  const groupCount = Math.ceil(totalPages / pagesPerGroup);

  return (
    <div className="bg-[#ffffff] rounded-xl shadow-sm border border-[#e0e0e0] p-6 mb-6">
      <h2 className="text-lg font-bold text-[#383838] mb-4 flex items-center font-['Merriweather']">
        <FileDigit className="w-5 h-5 mr-2 text-[#d97757]" />
        Group Pages
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#383838] mb-2">
            Pages per group
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min="1"
              max={totalPages}
              value={pagesPerGroup}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setPagesPerGroup(value);
                setInputValue(value.toString());
              }}
              className="flex-1 h-2 bg-[#e0e0e0] rounded-lg appearance-none cursor-pointer accent-[#d97757]"
            />
            <input
              type="number"
              min="1"
              max={totalPages}
              value={inputValue}
              onChange={(e) => {
                const value = e.target.value;
                setInputValue(value);

                // Allow empty input (for backspace/delete)
                if (value === '') {
                  return;
                }

                const numValue = parseInt(value);

                // Validate and set value
                if (!isNaN(numValue) && numValue > 0 && numValue <= totalPages) {
                  setPagesPerGroup(numValue);
                } else if (!isNaN(numValue) && numValue > totalPages) {
                  // If value is too large, set to max
                  setPagesPerGroup(totalPages);
                }
              }}
              onBlur={handleInputBlur}
              className="w-20 px-3 py-2 border border-[#e0e0e0] rounded-lg focus:ring-2 focus:ring-[#d97757] focus:border-[#d97757] outline-none text-[#383838] text-center bg-[#ffffff]"
            />
          </div>
        </div>

        <div className="text-sm text-[#6b6b6b] bg-[#fcf7f1] p-3 rounded-lg">
          <p>
            <span className="font-medium">{totalPages}</span> pages will be grouped into{' '}
            <span className="font-medium">{groupCount}</span> image{groupCount !== 1 ? 's' : ''}
            {pagesPerGroup > 1 && (
              <span> (with {pagesPerGroup} page{pagesPerGroup !== 1 ? 's' : ''} per group)</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GroupControls;