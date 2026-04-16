'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface WorkflowStep {
  number: number;
  title: string;
  description: string;
}

const workflowSteps: WorkflowStep[] = [
  {
    number: 1,
    title: 'Register mother',
    description:
      'Capture identity, contacts, location, facility link, CHW assignment.',
  },
  {
    number: 2,
    title: 'Track pregnancy episode',
    description:
      'Record EDD/LMP, obstetric history, risk factors, ANC plan.',
  },
  {
    number: 3,
    title: 'Capture ANC visits',
    description:
      'Record vitals, symptoms, labs, medications, clinician notes.',
  },
  {
    number: 4,
    title: 'Alert & escalate',
    description:
      'Notify assigned staff, escalate if unacknowledged, log closure.',
  },
  {
    number: 5,
    title: 'Delivery & postnatal',
    description:
      'Record delivery outcomes and schedule postnatal follow-up.',
  },
];

const WorkflowSection: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <section className="w-full bg-primary border border-neutral border-opacity-20 rounded-lg overflow-hidden">
      {/* Header / Collapse Button */}
      <button
        onClick={toggleExpand}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-primary-light transition-colors duration-200"
      >
        <h2 className="text-lg font-bold text-neutral text-left">
          System Workflow
        </h2>
        <ChevronDown
          size={24}
          className={`text-accent transform transition-transform duration-300 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-neutral border-opacity-20 px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {workflowSteps.map((step) => (
              <div
                key={step.number}
                className="bg-primary-light rounded-lg p-4 border border-accent border-opacity-20 hover:border-opacity-50 transition-all duration-200"
              >
                {/* Yellow Circle Badge */}
                <div className="flex items-center justify-center w-12 h-12 bg-warning text-primary rounded-full font-bold text-xl mb-4 flex-shrink-0">
                  {step.number}
                </div>

                {/* Title */}
                <h3 className="text-neutral font-semibold text-sm mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-neutral text-opacity-70 text-xs leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default WorkflowSection;
