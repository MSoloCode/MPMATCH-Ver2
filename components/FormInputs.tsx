'use client';

import React, { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/**
 * Text Input Component
 * Reusable form input with label, error state, and Tailwind styling
 */
export const TextInput = React.forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
    helperText?: string;
  }
>(({ label, error, helperText, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-2">
    {label && (
      <label className="text-sm font-medium text-neutral-900">
        {label}
        {props.required && <span className="text-red-600 ml-1">*</span>}
      </label>
    )}
    <input
      ref={ref}
      className={`
        px-3 py-2 bg-white rounded-lg
        border border-neutral-300
        text-neutral-900 text-sm
        placeholder-neutral-500
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
        disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed
        transition-colors
        ${error ? 'border-red-600 focus:ring-red-600' : ''}
        ${className}
      `}
      {...props}
    />
    {error && <span className="text-sm text-red-600">{error}</span>}
    {helperText && !error && <span className="text-sm text-neutral-600">{helperText}</span>}
  </div>
));

TextInput.displayName = 'TextInput';

/**
 * Phone Input Component
 * Specialized phone input with format guidance
 */
export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
  }
>(({ label = 'Phone Number', error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-medium text-neutral-900">
      {label}
      {props.required && <span className="text-red-600 ml-1">*</span>}
    </label>
    <input
      ref={ref}
      type="tel"
      placeholder="07XXXXXX or +256XXXXXXXXX"
      className={`
        px-3 py-2 bg-white rounded-lg
        border border-neutral-300
        text-neutral-900 text-sm
        placeholder-neutral-500
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
        disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed
        transition-colors
        ${error ? 'border-red-600 focus:ring-red-600' : ''}
        ${className}
      `}
      {...props}
    />
    {error && <span className="text-sm text-red-600">{error}</span>}
    <p className="text-xs text-neutral-600">Format: 07XXXXXX or +256XXXXXXXXX</p>
  </div>
));

PhoneInput.displayName = 'PhoneInput';

/**
 * Select Dropdown Component
 * Reusable select with label and error state
 */
export const SelectDropdown = React.forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    error?: string;
    options: Array<{ value: string | number; label: string }>;
    placeholder?: string;
  }
>(({ label, error, options, placeholder = 'Select an option...', className = '', ...props }, ref) => (
  <div className="flex flex-col gap-2">
    {label && (
      <label className="text-sm font-medium text-neutral-900">
        {label}
        {props.required && <span className="text-red-600 ml-1">*</span>}
      </label>
    )}
    <select
      ref={ref}
      className={`
        px-3 py-2 bg-white rounded-lg
        border border-neutral-300
        text-neutral-900 text-sm
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
        disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed
        transition-colors appearance-none bg-no-repeat
        ${error ? 'border-red-600 focus:ring-red-600' : ''}
        ${className}
      `}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M1 4l5 5 5-5'/%3E%3C/svg%3E")`,
        backgroundPosition: 'right 12px center',
        paddingRight: '32px',
      }}
      {...props}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {error && <span className="text-sm text-red-600">{error}</span>}
  </div>
));

SelectDropdown.displayName = 'SelectDropdown';

/**
 * Textarea Component
 * For multi-line text input (e.g., description fields)
 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
    helperText?: string;
  }
>(({ label, error, helperText, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-2">
    {label && (
      <label className="text-sm font-medium text-neutral-900">
        {label}
        {props.required && <span className="text-red-600 ml-1">*</span>}
      </label>
    )}
    <textarea
      ref={ref}
      className={`
        px-3 py-2 bg-white rounded-lg
        border border-neutral-300
        text-neutral-900 text-sm
        placeholder-neutral-500
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
        disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed
        transition-colors resize-none
        ${error ? 'border-red-600 focus:ring-red-600' : ''}
        ${className}
      `}
      {...props}
    />
    {error && <span className="text-sm text-red-600">{error}</span>}
    {helperText && !error && <span className="text-sm text-neutral-600">{helperText}</span>}
  </div>
));

Textarea.displayName = 'Textarea';

/**
 * Checkbox Component
 * Styled checkbox for forms
 */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
  }
>(({ label, error, className = '', ...props }, ref) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-3">
      <input
        ref={ref}
        type="checkbox"
        className={`
          w-5 h-5 rounded
          border border-neutral-300
          cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
          disabled:bg-neutral-100 disabled:cursor-not-allowed
          transition-colors
          ${error ? 'border-red-600' : ''}
          ${className}
        `}
        {...props}
      />
      {label && <label className="text-sm text-neutral-900 cursor-pointer">{label}</label>}
    </div>
    {error && <span className="text-sm text-red-600">{error}</span>}
  </div>
));

Checkbox.displayName = 'Checkbox';
