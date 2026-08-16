import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import theme from '../../theme/themes';

/**
 * VibeDropdown Z-Index Fix:
 *
 * If dropdown appears behind other elements:
 * 1. Make sure z-index of parent containers/sections the dropdown is in is higher than competing sections
 * 2. Make sure the 2 sections don't share the same styles (create specific styles if needed)
 * 3. Add overflow: 'visible' to ScrollView containers
 */

export default function VibeDropdown({
  options = [],
  selectedValue,
  onSelect,
  placeholder = 'Select option',
  style,
  onFocus,
  isCompleted = false,
  hideSelectedFromList = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === selectedValue);

  // Filter options to optionally hide selected value from list
  const filteredOptions =
    hideSelectedFromList && selectedValue
      ? options.filter((option) => option.value !== selectedValue)
      : options;

  const handleSelect = (option) => {
    onSelect(option.value);
    setIsOpen(false);
  };


  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={[
          styles.selector,
          isCompleted && styles.completedSelector,
          isOpen && styles.selectorOpen,
        ]}
        onPress={() => {
          onFocus?.();
          setIsOpen(!isOpen);
        }}
      >
        <Text
          style={[
            styles.selectorText,
            !selectedOption && styles.placeholderText,
            selectedOption?.value === 'none' && styles.placeholderText,
            selectedOption?.value !== 'none' && styles.selectedText,
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={styles.arrow}>{isOpen ? 'â–²' : 'â–¼'}</Text>
      </Pressable>


      {isOpen && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.optionsList} bounces={false}>
            {filteredOptions.map((option, i) => (
              <Pressable
                key={option.value}
                style={[
                  styles.option,
                  selectedValue === option.value && styles.selectedOption,
                  i === filteredOptions.length - 1 && styles.lastOption,
                ]}
                onPress={() => handleSelect(option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedValue === option.value &&
                      styles.selectedOptionText,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 99,
    elevation: 99,
  },
  selector: {
    borderWidth: 3,
    borderColor: theme.colors.vibeBlue,
    borderRadius: theme.sizes.borderRadius,
    paddingVertical: theme.sizes.inputPadding,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark transparent blacklight
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  selectorOpen: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: theme.colors.vibeBlue,
  },
  selectorText: {
    fontSize: 16,
    fontFamily: theme.fonts.main,
    color: theme.colors.textPrimary,
    flex: 1,
    paddingHorizontal: theme.sizes.inputPadding,
  },
  placeholderText: { color: '#888', fontWeight: '400' },
  selectedText: { color: '#ffffff', fontWeight: '500' },
  arrow: {
    fontSize: 12,
    color: theme.colors.vibeBlue || '#00C6FF',
    marginLeft: 8,
    marginRight: theme.sizes.inputPadding,
  },

  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 99,
    elevation: 99,
    backgroundColor: theme.colors.headerBackground, // Solid dark purple background
    borderRadius: theme.sizes.borderRadius,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 3,
    borderTopWidth: 0,
    borderColor: theme.colors.vibeBlue,
    maxHeight: 300,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    // Ensure solid background
    opacity: 1,
  },
  optionsList: { maxHeight: 300 },
  option: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.inputBorder,
  },
  lastOption: { borderBottomWidth: 0 },
  selectedOption: { backgroundColor: 'rgba(0, 198, 255, 0.1)' },
  optionText: {
    fontSize: 16,
    fontFamily: theme.fonts.main,
    color: theme.colors.textPrimary,
  },
  selectedOptionText: {
    color: theme.colors.vibeBlue || '#00C6FF',
    fontWeight: '600',
  },
  completedSelector: {
    // Removed purple border - keep neon blue regardless of state
  },
});

