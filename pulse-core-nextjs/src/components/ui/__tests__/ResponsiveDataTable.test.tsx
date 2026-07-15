import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ResponsiveDataTable } from '../ResponsiveDataTable';
import type { Column } from '../DataTable';

interface PatientRow {
  id: string;
  patient: string;
  shifNumber: string;
}

const rows: PatientRow[] = [
  {
    id: 'patient-1',
    patient: 'Amina Otieno',
    shifNumber: 'SHIF-2026-00000000000000000001',
  },
];

const columns: Column<PatientRow>[] = [
  { key: 'patient', header: 'Patient', accessor: (row) => row.patient },
  { key: 'shifNumber', header: 'SHIF Number', accessor: (row) => row.shifNumber },
];

describe('ResponsiveDataTable', () => {
  it('makes mobile row cards keyboard accessible when rows are clickable', () => {
    const onRowClick = jest.fn();

    render(
      <ResponsiveDataTable
        data={rows}
        columns={columns}
        keyExtractor={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    const mobileCard = screen.getByRole('button', { name: /amina otieno/i });

    mobileCard.focus();
    expect(mobileCard).toHaveFocus();

    fireEvent.keyDown(mobileCard, { key: 'Enter' });
    fireEvent.keyDown(mobileCard, { key: ' ' });

    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenNthCalledWith(1, rows[0]);
    expect(onRowClick).toHaveBeenNthCalledWith(2, rows[0]);
  });
});
