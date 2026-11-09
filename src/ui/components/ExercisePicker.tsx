import React, { useMemo } from 'react';
import { Exercise, SupersetPair } from '../../domain/models/types';
import {
  BODY_REGION_GROUPS,
  EQUIPMENT_FILTERS,
  buildExerciseOptions,
  buildSupersetOptions,
} from '../../domain/catalog/pickerOptions';
import { SelectSheet } from './SelectSheet';

type SharedProps = Pick<
  React.ComponentProps<typeof SelectSheet>,
  | 'sheetTitle'
  | 'suggestedIds'
  | 'suggestedLabel'
  | 'eyebrow'
  | 'size'
  | 'disabled'
  | 'className'
  | 'placeholder'
  | 'placeholderSubtitle'
>;

export interface ExercisePickerProps extends Partial<SharedProps> {
  exercises: Exercise[];
  value: string | null | undefined;
  onChange: (exerciseId: string) => void;
}

/** Searchable exercise picker grouped by body region with equipment filters. */
export const ExercisePicker: React.FC<ExercisePickerProps> = ({
  exercises,
  value,
  onChange,
  sheetTitle = 'Choose exercise',
  ...rest
}) => {
  const options = useMemo(() => buildExerciseOptions(exercises), [exercises]);
  return (
    <SelectSheet
      value={value}
      options={options}
      onChange={onChange}
      sheetTitle={sheetTitle}
      groups={BODY_REGION_GROUPS}
      filters={EQUIPMENT_FILTERS}
      placeholder="Choose exercise"
      {...rest}
    />
  );
};

export interface SupersetPickerProps extends Partial<SharedProps> {
  supersets: SupersetPair[];
  exercises: Exercise[];
  /** undefined/null => custom pairing (no preset). */
  value: string | null | undefined;
  onChange: (supersetId: string) => void;
}

/**
 * Searchable superset-preset picker. Each preset is listed under the body
 * region of both of its exercises (e.g. Back *and* Chest).
 */
export const SupersetPicker: React.FC<SupersetPickerProps> = ({
  supersets,
  exercises,
  value,
  onChange,
  sheetTitle = 'Choose superset preset',
  ...rest
}) => {
  const options = useMemo(
    () => buildSupersetOptions(supersets, exercises),
    [supersets, exercises]
  );
  return (
    <SelectSheet
      value={value}
      options={options}
      onChange={onChange}
      sheetTitle={sheetTitle}
      groups={BODY_REGION_GROUPS}
      filters={EQUIPMENT_FILTERS}
      placeholder="Custom pairing"
      placeholderSubtitle="Tap to pick a ready-made superset"
      searchPlaceholder="Search by exercise, muscle or equipment"
      {...rest}
    />
  );
};
