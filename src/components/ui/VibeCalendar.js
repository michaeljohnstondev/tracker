// components/ui/base/VibeCalendar.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { Modal, View, TouchableOpacity, Text, ScrollView } from 'react-native';
import { useThemedStyles } from '../../theme/ThemeContext';

/**
 * Pure JS calendar component - no native dependencies
 * Built for punk/cyberpunk theme
 */
const VibeCalendar = ({
  visible,
  initialDate,
  onConfirm,
  onClose,
  minimumDate,
  maximumDate,
}) => {
  const styles = useThemedStyles(makeStyles);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = initialDate || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    return initialDate || new Date();
  });

  // Memoize helper functions
  const getDaysInMonth = useCallback((date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }, []);

  const getFirstDayOfMonth = useCallback((date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }, []);

  const isDateDisabled = useCallback((date) => {
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (minimumDate) {
      const minDate = new Date(minimumDate);
      minDate.setHours(0, 0, 0, 0);
      if (compareDate < minDate) return true;
    }

    if (maximumDate) {
      const maxDate = new Date(maximumDate);
      maxDate.setHours(0, 0, 0, 0);
      if (compareDate > maxDate) return true;
    }

    return false;
  }, [minimumDate, maximumDate]);

  const isToday = useCallback((date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate.getTime() === today.getTime();
  }, []);

  const isSelected = useCallback((date) => {
    if (!selectedDate) return false;
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return compareDate.getTime() === selected.getTime();
  }, [selectedDate]);

  // Navigate months
  const previousMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  // Handle day press
  const handleDayPress = useCallback((day) => {
    if (day === null) return;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (!isDateDisabled(date)) {
      setSelectedDate(date);
    }
  }, [currentMonth, isDateDisabled]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    onConfirm(selectedDate);
  }, [onConfirm, selectedDate]);

  // Memoize calendar data - only recalculate when month changes
  const calendarData = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }, [currentMonth, getDaysInMonth, getFirstDayOfMonth]);

  // Memoize month/year string
  const monthYear = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={previousMonth} style={styles.navButton}>
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerText}>{monthYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Week day headers */}
          <View style={styles.weekDaysRow}>
            {weekDays.map((day) => (
              <View key={day} style={styles.weekDayCell}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <ScrollView style={styles.calendarScroll}>
            <View style={styles.calendarGrid}>
              {calendarData.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const disabled = isDateDisabled(date);
                const today = isToday(date);
                const selected = isSelected(date);

                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayCell,
                      selected && styles.selectedDay,
                      today && !selected && styles.todayDay,
                      disabled && styles.disabledDay,
                    ]}
                    onPress={() => handleDayPress(day)}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.selectedDayText,
                        today && !selected && styles.todayDayText,
                        disabled && styles.disabledDayText,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (t) => ({
  overlay: {
    flex: 1,
    backgroundColor: t.semantic.overlayStrong,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: t.colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.vibeBlue,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: t.colors.vibeBlue,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 32,
    color: t.colors.vibeBlue,
    fontWeight: 'bold',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: t.colors.vibeBlue,
  },
  weekDaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: t.colors.vibeBlue,
    paddingVertical: 12,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    color: t.colors.vibeBlue,
    fontSize: 12,
    fontWeight: '600',
  },
  calendarScroll: {
    maxHeight: 300,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  selectedDay: {
    borderWidth: 3,
    borderColor: t.colors.vibeGreen,
    borderRadius: 20,
    backgroundColor: t.colors.vibeBackgroundGreen,
  },
  todayDay: {
    // Removed - using selectedDay style instead
  },
  disabledDay: {
    opacity: 0.3,
  },
  dayText: {
    color: t.colors.textPrimary,
    fontSize: 16,
    fontWeight: '400',
  },
  selectedDayText: {
    color: t.colors.vibeGreen,
    fontWeight: 'bold',
    fontSize: 18,
  },
  todayDayText: {
    // Removed - using selectedDayText style instead
  },
  disabledDayText: {
    color: t.colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 2,
    borderTopColor: t.colors.vibeBlue,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: t.colors.textSecondary,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: t.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: t.colors.vibeBlue,
    backgroundColor: 'transparent',
  },
  confirmButtonText: {
    color: t.colors.vibeBlue,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default VibeCalendar;
