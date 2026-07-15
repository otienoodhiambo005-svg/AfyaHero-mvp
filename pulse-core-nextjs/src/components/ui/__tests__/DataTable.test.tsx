import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DataTable, { type Column } from '../DataTable';

interface VisitRow {
  id: string;
  patient: string;
}

const rows: VisitRow[] = Array.from({ length: 200 }, (_, index) => ({
  id: `visit-${index + 1}`,
  patient: `Patient ${index + 1}`,
}));

const columns: Column<VisitRow>[] = [
  { key: 'patient', header: 'Patient', accessor: (row) => row.patient },
];

describe('DataTable', () => {
  it('limits pagination controls for large result sets', () => {
    render(
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(row) => row.id}
      />,
    );

    expect(screen.getByRole('button', { name: /go to page 1/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /go to page 5/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to page 20/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /go to page 10/i })).not.toBeInTheDocument();
  });
});
