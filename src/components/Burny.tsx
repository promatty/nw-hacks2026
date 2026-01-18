import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type BurnyExpression =
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'smug'
  | 'disappointed'
  | 'savage'
  | 'bored'
  | 'shocked'
  | 'evil';

interface BurnyProps {
  expression?: BurnyExpression;
  message?: string;
  size?: number;
}

const Burny: React.FC<BurnyProps> = ({
  expression = 'neutral',
  message = '',
  size = 300
}) => {
  const [isIdle, setIsIdle] = useState(true);

  // Idle floating animation
  const floatAnimation = {
<<<<<<< HEAD
    y: [0, -10, 0]
  };

  const floatTransition = {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut" as const
=======
    y: [0, -10, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
>>>>>>> main
  };

  // Flame flicker animation
  const flickerAnimation = {
    scale: [1, 1.05, 0.98, 1.02, 1],
<<<<<<< HEAD
    opacity: [0.9, 1, 0.95, 1, 0.9]
  };

  const flickerTransition = {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut" as const
=======
    opacity: [0.9, 1, 0.95, 1, 0.9],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
>>>>>>> main
  };

  // Expression definitions with anime-style features
  const expressions = {
    neutral: {
      leftEye: { type: 'circle', scale: 1, rotation: 0 },
      rightEye: { type: 'circle', scale: 1, rotation: 0 },
      mouth: { path: 'M 140 200 Q 180 210 220 200', emotion: 'neutral' },
      eyebrows: { leftY: -15, rightY: -15, leftRotation: 0, rightRotation: 0 }
    },
    happy: {
      leftEye: { type: 'arc', scale: 1.2, rotation: 0 },
      rightEye: { type: 'arc', scale: 1.2, rotation: 0 },
      mouth: { path: 'M 140 200 Q 180 220 220 200', emotion: 'happy' },
      eyebrows: { leftY: -20, rightY: -20, leftRotation: -5, rightRotation: 5 }
    },
    angry: {
      leftEye: { type: 'angry', scale: 1, rotation: 15 },
      rightEye: { type: 'angry', scale: 1, rotation: -15 },
      mouth: { path: 'M 140 210 Q 180 195 220 210', emotion: 'angry' },
      eyebrows: { leftY: -5, rightY: -5, leftRotation: -25, rightRotation: 25 }
    },
    smug: {
      leftEye: { type: 'half', scale: 0.8, rotation: 0 },
      rightEye: { type: 'half', scale: 0.8, rotation: 0 },
      mouth: { path: 'M 140 200 Q 160 195 180 200 Q 200 195 220 200', emotion: 'smug' },
      eyebrows: { leftY: -10, rightY: -10, leftRotation: 10, rightRotation: -10 }
    },
    disappointed: {
      leftEye: { type: 'dead', scale: 1, rotation: 0 },
      rightEye: { type: 'dead', scale: 1, rotation: 0 },
      mouth: { path: 'M 140 210 Q 180 205 220 210', emotion: 'disappointed' },
      eyebrows: { leftY: -8, rightY: -8, leftRotation: 15, rightRotation: -15 }
    },
    savage: {
      leftEye: { type: 'sharp', scale: 1.1, rotation: -10 },
      rightEye: { type: 'sharp', scale: 1.1, rotation: 10 },
      mouth: { path: 'M 135 200 Q 180 225 225 200', emotion: 'savage' },
      eyebrows: { leftY: -12, rightY: -12, leftRotation: -15, rightRotation: 15 }
    },
    bored: {
      leftEye: { type: 'half', scale: 0.6, rotation: 0 },
      rightEye: { type: 'half', scale: 0.6, rotation: 0 },
      mouth: { path: 'M 150 205 L 210 205', emotion: 'bored' },
      eyebrows: { leftY: -8, rightY: -8, leftRotation: 0, rightRotation: 0 }
    },
    shocked: {
      leftEye: { type: 'wide', scale: 1.5, rotation: 0 },
      rightEye: { type: 'wide', scale: 1.5, rotation: 0 },
      mouth: { path: 'M 170 210 Q 175 220 180 210 Q 185 220 190 210', emotion: 'shocked' },
      eyebrows: { leftY: -25, rightY: -25, leftRotation: -20, rightRotation: 20 }
    },
    evil: {
      leftEye: { type: 'evil', scale: 1, rotation: 10 },
      rightEye: { type: 'evil', scale: 1, rotation: -10 },
      mouth: { path: 'M 130 195 Q 180 215 230 195', emotion: 'evil' },
      eyebrows: { leftY: -10, rightY: -10, leftRotation: -30, rightRotation: 30 }
    }
  };

  const currentExpression = expressions[expression];

  // Render eye based on type
  const renderEye = (eyeData: any, x: number, y: number, isLeft: boolean) => {
    const baseSize = 20;
    const animationKey = isLeft ? 'left-eye' : 'right-eye';

    switch (eyeData.type) {
      case 'circle':
        return (
          <motion.g
            key={animationKey}
            initial={{ scale: 0 }}
            animate={{ scale: eyeData.scale }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <circle cx={x} cy={y} r={baseSize} fill="#000" />
            <motion.circle
              cx={x - 5}
              cy={y - 5}
              r={6}
              fill="#fff"
              animate={{ x: [0, 2, 0], y: [0, -1, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </motion.g>
        );

      case 'arc':
        return (
          <motion.path
            key={animationKey}
            d={`M ${x - baseSize} ${y} Q ${x} ${y - 15} ${x + baseSize} ${y}`}
            stroke="#000"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
        );

      case 'angry':
        return (
          <motion.g key={animationKey}>
            <motion.line
              x1={x - baseSize}
              y1={y}
              x2={x + baseSize}
              y2={y}
              stroke="#000"
              strokeWidth="5"
              strokeLinecap="round"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1, rotate: eyeData.rotation }}
              transition={{ type: "spring", stiffness: 300 }}
            />
            <circle cx={x} cy={y + 3} r={8} fill="#000" />
          </motion.g>
        );

      case 'half':
        return (
          <motion.path
            key={animationKey}
            d={`M ${x - baseSize} ${y} L ${x + baseSize} ${y}`}
            stroke="#000"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
        );

      case 'dead':
        return (
          <motion.g key={animationKey}>
            <motion.line
              x1={x - 12}
              y1={y - 12}
              x2={x + 12}
              y2={y + 12}
              stroke="#000"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
            />
            <motion.line
              x1={x - 12}
              y1={y + 12}
              x2={x + 12}
              y2={y - 12}
              stroke="#000"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
            />
          </motion.g>
        );

      case 'sharp':
        return (
          <motion.g key={animationKey}>
            <motion.path
              d={`M ${x - baseSize} ${y + 10} L ${x} ${y - 10} L ${x + baseSize} ${y + 10} Z`}
              fill="#000"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
            />
            <circle cx={x} cy={y + 2} r={4} fill="#ff0000" />
          </motion.g>
        );

      case 'wide':
        return (
          <motion.g key={animationKey}>
            <motion.circle
              cx={x}
              cy={y}
              r={baseSize * 1.2}
              fill="none"
              stroke="#000"
              strokeWidth="4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400 }}
            />
            <circle cx={x} cy={y} r={baseSize * 0.8} fill="#000" />
            <circle cx={x - 6} cy={y - 6} r={5} fill="#fff" />
          </motion.g>
        );

      case 'evil':
        return (
          <motion.g key={animationKey}>
            <motion.path
              d={`M ${x - baseSize} ${y + 5} Q ${x} ${y - 15} ${x + baseSize} ${y + 5}`}
              stroke="#000"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
            />
            <motion.circle
              cx={x}
              cy={y}
              r={8}
              fill="#8B0000"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.g>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 360 400"
        style={{ overflow: 'visible' }}
        animate={floatAnimation}
        transition={floatTransition}
      >
        {/* Flame body layers */}
        <defs>
          <linearGradient id="flameGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#FFD700', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#FF6B00', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#FF0000', stopOpacity: 0.8 }} />
          </linearGradient>
          <linearGradient id="flameGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#FFED4E', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#FF9500', stopOpacity: 0.9 }} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer flame */}
        <motion.path
          d="M 180 50 Q 140 80 130 130 Q 120 180 130 230 Q 140 280 160 320 Q 170 350 180 380 Q 190 350 200 320 Q 220 280 230 230 Q 240 180 230 130 Q 220 80 180 50 Z"
          fill="url(#flameGradient1)"
          filter="url(#glow)"
          animate={flickerAnimation}
          transition={flickerTransition}
        />

        {/* Middle flame */}
        <motion.path
          d="M 180 70 Q 155 95 150 140 Q 145 180 155 220 Q 165 260 180 300 Q 195 260 205 220 Q 215 180 210 140 Q 205 95 180 70 Z"
          fill="url(#flameGradient2)"
          animate={{ scale: [1, 1.08, 0.95, 1.03, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" as const }}
        />

        {/* Inner flame (hottest part) */}
        <motion.path
          d="M 180 100 Q 170 120 168 150 Q 166 180 175 210 Q 180 230 180 250 Q 180 230 185 210 Q 194 180 192 150 Q 190 120 180 100 Z"
          fill="#FFFACD"
          animate={{ scale: [1, 1.15, 0.9, 1.1, 1], opacity: [0.9, 1, 0.85, 1, 0.9] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" as const }}
        />

        {/* Face container */}
        <g>
          {/* Eyebrows */}
          <motion.line
            x1={135}
            y1={150 + currentExpression.eyebrows.leftY}
            x2={165}
            y2={155 + currentExpression.eyebrows.leftY}
            stroke="#000"
            strokeWidth="5"
            strokeLinecap="round"
            animate={{
              y: currentExpression.eyebrows.leftY,
              rotate: currentExpression.eyebrows.leftRotation
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ originX: '150px', originY: '150px' }}
          />
          <motion.line
            x1={195}
            y1={155 + currentExpression.eyebrows.rightY}
            x2={225}
            y2={150 + currentExpression.eyebrows.rightY}
            stroke="#000"
            strokeWidth="5"
            strokeLinecap="round"
            animate={{
              y: currentExpression.eyebrows.rightY,
              rotate: currentExpression.eyebrows.rightRotation
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ originX: '210px', originY: '150px' }}
          />

          {/* Eyes */}
          {renderEye(currentExpression.leftEye, 150, 170, true)}
          {renderEye(currentExpression.rightEye, 210, 170, false)}

          {/* Mouth */}
          <motion.path
            d={currentExpression.mouth.path}
            stroke="#000"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          />

          {/* Blush marks for certain expressions */}
          {(expression === 'happy' || expression === 'savage') && (
            <>
              <motion.ellipse
                cx={120}
                cy={185}
                rx={15}
                ry={10}
                fill="#FF6B9D"
                opacity={0.4}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
              />
              <motion.ellipse
                cx={240}
                cy={185}
                rx={15}
                ry={10}
                fill="#FF6B9D"
                opacity={0.4}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
              />
            </>
          )}

          {/* Sweat drop for disappointed/bored */}
          {(expression === 'disappointed' || expression === 'bored') && (
            <motion.g
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring" }}
            >
              <ellipse cx={235} cy={155} rx={8} ry={12} fill="#4FC3F7" opacity={0.7} />
              <circle cx={235} cy={150} r={3} fill="#fff" opacity={0.9} />
            </motion.g>
          )}

          {/* Anger vein for angry expression */}
          {expression === 'angry' && (
            <motion.g
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <path
                d="M 115 140 L 120 135 L 125 140 L 120 145 Z"
                fill="#8B0000"
                opacity={0.8}
              />
            </motion.g>
          )}

          {/* Smirk lines for smug/evil */}
          {(expression === 'smug' || expression === 'evil') && (
            <>
              <motion.line
                x1={225}
                y1={200}
                x2={235}
                y2={205}
                stroke="#000"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
              />
            </>
          )}
        </g>

        {/* Particle effects for more intense expressions */}
        {(expression === 'angry' || expression === 'savage') && (
          <>
            {[...Array(5)].map((_, i) => (
              <motion.circle
                key={`particle-${i}`}
                cx={Math.random() * 360}
                cy={Math.random() * 400}
                r={3}
                fill="#FF4500"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  y: [0, -30, -60]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </>
        )}
      </motion.svg>

      {/* Speech bubble for messages */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FF5E00 100%)',
              color: 'white',
              padding: '20px 30px',
              borderRadius: '20px',
              maxWidth: '400px',
              fontSize: '18px',
              fontWeight: 'bold',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '15px solid transparent',
              borderRight: '15px solid transparent',
              borderBottom: '15px solid #FF9500'
            }} />
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Burny;
