import React from 'react';

const TRADING_PAIRS = [
  { id: 'eth-usdc', name: 'ETH/USDC', default: true },
  { id: 'uni-usdc', name: 'UNI/USDC', default: false },
  { id: 'usdc-usdt', name: 'USDC/USDT', default: false },
  { id: 'wbtc-usdc', name: 'WBTC/USDC', default: false },
] as const;

type PairId = typeof TRADING_PAIRS[number]['id'];

interface PairSelectorProps {
  selectedPair: PairId;
  onPairChange: (pairId: PairId) => void;
}

const PairSelector: React.FC<PairSelectorProps> = ({ selectedPair, onPairChange }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      marginBottom: '10px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    }}>
      {TRADING_PAIRS.map((pair) => {
        const isActive = selectedPair === pair.id;
        
        return (
          <button
            key={pair.id}
            onClick={() => onPairChange(pair.id)}
            style={{
              padding: '8px 16px',
              border: '2px solid',
              borderColor: isActive ? '#FF37C7' : '#ccc',
              borderRadius: '8px',
              backgroundColor: isActive ? '#FF37C7' : '#fff',
              color: isActive ? '#fff' : '#333',
              fontWeight: isActive ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s ease',
              minWidth: '80px',
            }}
          >
            {pair.name}
          </button>
        );
      })}
    </div>
  );
};

export { TRADING_PAIRS };
export type { PairId };
export default PairSelector;