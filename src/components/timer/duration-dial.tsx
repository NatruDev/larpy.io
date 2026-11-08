import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { formatGoal, formatGoalShort } from '@/lib/format';
import { Fonts, OnSubject, useTheme, withAlpha } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** One trip around the dial, like a clock face. Keep circling for longer sessions. */
const LAP_MINUTES = 60;

/** Ticks start this far inside the pie's edge */
const TICK_INSET = 5;
const TICK_MAJOR = 11;
const TICK_MINOR = 5;
const KNOB = 5;
/** Room around the pie so the knob, which rides its edge, isn't clipped */
const MARGIN = KNOB + 1;
/** Movement (px) before a press becomes a drag; let go within it and it's a tap */
const TAP_SLOP = 3;
/** Touch target of the − and + glyphs */
const HIT = 56;
/** Padding that keeps the label's text shadow inside its (clipped) box */
const SHADOW_ROOM = 12;
/** Peak opacity of the press highlight */
const FLASH = 0.22;

/** Fraction of the current lap shown by the pie; an exact hour is a full disc rather than an empty one. */
function lapFraction(minutes: number) {
  'worklet';
  if (minutes <= 0) return 0;
  return (minutes % LAP_MINUTES || LAP_MINUTES) / LAP_MINUTES;
}

/** A pie wedge from 12 o'clock, clockwise. */
function piePath(fraction: number, c: number, r: number) {
  'worklet';
  if (fraction <= 0.0001) return `M ${c} ${c}`;
  if (fraction >= 0.9999) {
    return `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r} Z`;
  }
  const angle = fraction * 2 * Math.PI;
  const x = c + r * Math.sin(angle);
  const y = c - r * Math.cos(angle);
  return `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
}

/**
 * A lens hugging one side of the dial: the dial's own edge between two clock angles (degrees clockwise
 * from 12, span under 180), closed by a gentler curve that bulges toward the center, reaching `apex` from it.
 */
function lensPath(c: number, r: number, fromDeg: number, toDeg: number, apex: number) {
  const point = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${c + r * Math.sin(a)} ${c - r * Math.cos(a)}`;
  };
  const halfSpan = (((toDeg - fromDeg) / 2) * Math.PI) / 180;
  const halfChord = r * Math.sin(halfSpan);
  // How far the inner curve bows in past the chord, and the circle radius that gives that bow.
  const sagitta = r * Math.cos(halfSpan) - apex;
  const innerRadius = (halfChord * halfChord + sagitta * sagitta) / (2 * sagitta);
  // Out along the edge clockwise, then back along the inner curve (also clockwise, so it bows inward).
  return `M ${point(fromDeg)} A ${r} ${r} 0 0 1 ${point(toDeg)} A ${innerRadius} ${innerRadius} 0 0 1 ${point(fromDeg)} Z`;
}

type DurationDialProps = {
  /** null = no limit */
  minutes: number | null;
  onChange: (minutes: number) => void;
  min: number;
  max: number;
  step: number;
  color: string;
  /** Small line under the value, e.g. "ends 11:47 PM" */
  caption: string;
  size?: number;
  /** Sweep to new values (default). Off for jumps like presets, where spinning through laps looks odd. */
  animated?: boolean;
};

/**
 * Circular duration picker drawn as a solid pie with minute ticks inside its edge. Drag clockwise to add
 * time (one lap = 60 min), counter-clockwise to remove it; snaps to `step`. A press that moves past
 * TAP_SLOP is a drag; one released within it is a tap: left half removes `step`, right half adds it. The
 * touched half lights up while held,
 * iOS style. Changes sweep smoothly through the minutes in between unless `animated` is off. Screen
 * readers get increment/decrement actions and the − / + buttons.
 */
export function DurationDial({
  minutes,
  onChange,
  min,
  max,
  step,
  color,
  caption,
  size = 300,
  animated = true,
}: DurationDialProps) {
  const c = size / 2;
  const pieRadius = c - MARGIN;
  // − and + sit inward of the knob's path so the two never collide.
  const buttonOffset = Math.round(pieRadius * 0.66);
  // The press highlights: a lens on each side, from about 1 to 5 o'clock (and its mirror), bowing in to
  // just short of the center.
  const lessLens = lensPath(c, pieRadius, 210, 330, pieRadius * 0.2);
  const moreLens = lensPath(c, pieRadius, 30, 150, pieRadius * 0.2);

  const ticks = useMemo(
    () =>
      Array.from({ length: LAP_MINUTES }, (_, i) => {
        const angle = (i / LAP_MINUTES) * 2 * Math.PI;
        const major = i % 5 === 0;
        const outer = pieRadius - TICK_INSET;
        const inner = outer - (major ? TICK_MAJOR : TICK_MINOR);
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        return { key: i, major, x1: c + inner * sin, y1: c - inner * cos, x2: c + outer * sin, y2: c - outer * cos };
      }),
    [c, pieRadius]
  );

  // The minutes the pie currently shows; animates toward `minutes`.
  const shown = useSharedValue(minutes ?? LAP_MINUTES);
  const flashLess = useSharedValue(0);
  const flashMore = useSharedValue(0);
  const drag = useRef({
    active: false,
    /** Moved past TAP_SLOP: a drag, not a tap */
    moved: false,
    startX: 0,
    startY: 0,
    centerX: 0,
    centerY: 0,
    lastAngle: 0,
    value: 0,
  });

  useEffect(() => {
    // No limit fills the disc by sweeping up to the next whole lap.
    const target = minutes ?? Math.max(LAP_MINUTES, Math.ceil(shown.get() / LAP_MINUTES) * LAP_MINUTES);
    if (!animated) {
      shown.set(target);
      return;
    }
    const duration = drag.current.active ? 90 : Math.min(700, 320 + Math.abs(target - shown.get()) * 2);
    shown.set(withTiming(target, { duration, easing: Easing.out(Easing.cubic) }));
  }, [minutes, animated, shown]);

  const pieProps = useAnimatedProps(() => ({ d: piePath(lapFraction(shown.get()), c, pieRadius) }));
  const knobProps = useAnimatedProps(() => {
    const angle = lapFraction(shown.get()) * 2 * Math.PI;
    return { cx: c + pieRadius * Math.sin(angle), cy: c - pieRadius * Math.cos(angle) };
  });
  const lessFlashProps = useAnimatedProps(() => ({ fillOpacity: flashLess.get() }));
  const moreFlashProps = useAnimatedProps(() => ({ fillOpacity: flashMore.get() }));

  const angleAt = (e: GestureResponderEvent) =>
    Math.atan2(e.nativeEvent.pageX - drag.current.centerX, -(e.nativeEvent.pageY - drag.current.centerY));

  const onGrant = (e: GestureResponderEvent) => {
    // Children ignore touches, so location is relative to the dial; pin the center in page coordinates.
    const { pageX, pageY, locationX, locationY } = e.nativeEvent;
    drag.current.active = true;
    drag.current.moved = false;
    drag.current.startX = pageX;
    drag.current.startY = pageY;
    drag.current.centerX = pageX - locationX + c;
    drag.current.centerY = pageY - locationY + c;
    drag.current.lastAngle = angleAt(e);
    drag.current.value = minutes ?? LAP_MINUTES;
    // Light up the touched half right away; it fades if this turns into a drag.
    flashOn(locationX < c ? flashLess : flashMore);
  };

  const onMove = (e: GestureResponderEvent) => {
    if (!drag.current.moved) {
      const fromStart = Math.hypot(e.nativeEvent.pageX - drag.current.startX, e.nativeEvent.pageY - drag.current.startY);
      if (fromStart < TAP_SLOP) return;
      drag.current.moved = true;
      flashOff(flashLess);
      flashOff(flashMore);
    }
    // Angles jump wildly right at the center, so ignore the middle of the dial.
    const dx = e.nativeEvent.pageX - drag.current.centerX;
    const dy = e.nativeEvent.pageY - drag.current.centerY;
    if (Math.hypot(dx, dy) < pieRadius / 4) return;

    const angle = angleAt(e);
    // Unwrap so crossing 12 o'clock keeps counting instead of jumping by a lap.
    let delta = angle - drag.current.lastAngle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    drag.current.lastAngle = angle;

    drag.current.value = Math.min(max, Math.max(min, drag.current.value + (delta / (2 * Math.PI)) * LAP_MINUTES));
    const snapped = Math.min(max, Math.max(min, Math.round(drag.current.value / step) * step));
    if (snapped !== minutes) onChange(snapped);
  };

  const onRelease = (e: GestureResponderEvent) => {
    drag.current.active = false;
    if (!drag.current.moved) stepBy(e.nativeEvent.pageX < drag.current.centerX ? -step : step);
    flashOff(flashLess);
    flashOff(flashMore);
  };

  const onTerminate = () => {
    drag.current.active = false;
    flashOff(flashLess);
    flashOff(flashMore);
  };

  const stepBy = (delta: number) => {
    const next = Math.min(max, Math.max(min, (minutes ?? LAP_MINUTES) + delta));
    if (next !== minutes) onChange(next);
  };

  const valueText = minutes === null ? 'No limit' : formatGoal(minutes);
  const label = minutes === null ? '∞' : formatGoalShort(minutes);

  return (
    <View style={{ width: size, height: size }}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Session length"
        // Both forms: native reads accessibilityValue, react-native-web only maps the aria prop.
        accessibilityValue={{ text: valueText }}
        aria-valuetext={valueText}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => stepBy(e.nativeEvent.actionName === 'increment' ? step : -step)}
        style={StyleSheet.absoluteFill}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onTerminate}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={size} height={size}>
            <Circle cx={c} cy={c} r={pieRadius} fill={withAlpha(OnSubject, 0.06)} />
            <AnimatedPath animatedProps={pieProps} fill={color} />
            {ticks.map((t) => (
              <Line
                key={t.key}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={OnSubject}
                strokeOpacity={t.major ? 0.6 : 0.25}
                strokeWidth={t.major ? 2 : 1.5}
                strokeLinecap="round"
              />
            ))}
            <AnimatedPath d={lessLens} fill={OnSubject} fillOpacity={0} animatedProps={lessFlashProps} />
            <AnimatedPath d={moreLens} fill={OnSubject} fillOpacity={0} animatedProps={moreFlashProps} />
            {minutes !== null ? (
              <AnimatedCircle animatedProps={knobProps} r={KNOB} fill={OnSubject} fillOpacity={0.85} />
            ) : null}
          </Svg>
        </View>
      </View>

      {/* Label in the middle; it ignores touches so dragging works right across it. */}
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {/* Not selectable, so dragging with a mouse doesn't highlight the text. */}
        <Text
          selectable={false}
          style={[styles.value, label.length > 6 && styles.valueLong, styles.shadow]}
          numberOfLines={1}>
          {label}
        </Text>
        <Text selectable={false} variant="label" style={[styles.caption, styles.shadow]} numberOfLines={1}>
          {caption}
        </Text>
      </View>

      <StepButton
        icon="remove"
        label={`${step} minutes less`}
        disabled={minutes !== null && minutes <= min}
        onPress={() => stepBy(-step)}
        flash={flashLess}
        style={{ left: c - buttonOffset - HIT / 2, top: c - HIT / 2 }}
      />
      <StepButton
        icon="add"
        label={`${step} minutes more`}
        disabled={minutes !== null && minutes >= max}
        onPress={() => stepBy(step)}
        flash={flashMore}
        style={{ left: c + buttonOffset - HIT / 2, top: c - HIT / 2 }}
      />
    </View>
  );
}

function flashOn(flash: SharedValue<number>) {
  flash.set(withTiming(FLASH, { duration: 60 }));
}

function flashOff(flash: SharedValue<number>) {
  flash.set(withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) }));
}

type StepButtonProps = {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
  /** Opacity of this half's highlight */
  flash: SharedValue<number>;
  style: { left: number; top: number };
};

/**
 * A bare − or + glyph. Touches pass straight through to the dial, so a press here can still become a drag
 * and a tap is handled like a tap anywhere on that half. It stays a real button for keyboard focus (web)
 * and screen readers; like iOS controls, its half of the dial lights up while it's pressed.
 */
function StepButton({ icon, label, disabled, onPress, flash, style }: StepButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => flashOn(flash)}
      onPressOut={() => flashOff(flash)}
      pointerEvents="none"
      style={[styles.step, style]}>
      <Ionicons
        name={icon}
        size={30}
        color={disabled ? withAlpha(colors.text, 0.35) : OnSubject}
        style={disabled ? null : styles.glyphShadow}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  value: {
    fontFamily: Fonts.bold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1,
    color: OnSubject,
    fontVariant: ['tabular-nums'],
  },
  // Two-digit hours ("10h 55m") step down so they stay clear of the − and + glyphs.
  valueLong: { fontSize: 32, lineHeight: 44 },
  caption: { color: OnSubject, opacity: 0.9 },
  // Keeps white text readable over both the colored wedge and the dark part of the dial.
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    // Single-line text clips to its box, which would cut the shadow off; pad the box to fit the shadow and
    // pull the margins back in so the layout doesn't move.
    padding: SHADOW_ROOM,
    margin: -SHADOW_ROOM,
  },
  glyphShadow: { textShadowColor: 'rgba(0, 0, 0, 0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  step: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
});
