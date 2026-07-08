import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InfineonDesignSystemModule } from '@infineon/infineon-design-system-angular';
import {
  AdminService,
  LookupItem,
  Sb,
  Sb2sbowner,
  Sballmap,
  Sbcostmap,
  Sbengovh,
  Sbol,
} from '../../services/admin.service';

type SectionId =
  | 'option1'
  | 'option2'
  | 'option3'
  | 'option4'
  | 'option5'
  | 'option6'
  | 'option7'
  | 'option8'
  | 'option9'
  | 'option10';

type ModalId =
  | null
  | 'addSbol'
  | 'updateSbol'
  | 'addSb'
  | 'addSbOwner'
  | 'updateOwner'
  | 'addCost'
  | 'updateCost'
  | 'confirmDeleteCost'
  | 'addEngovh'
  | 'updateEngovh';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, InfineonDesignSystemModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit {
  private readonly api = inject(AdminService);

  readonly options: { id: SectionId; label: string }[] = [
    { id: 'option1', label: 'Outsourcing Location' },
    { id: 'option2', label: 'Service Bundle to Client Corridor' },
    { id: 'option3', label: 'Service Bundle Owner to Service Bundle' },
    { id: 'option4', label: 'Service Bundle Path' },
    { id: 'option5', label: 'Service Bundle Email Template' },
    { id: 'option6', label: 'Cost Mapping' },
    { id: 'option7', label: 'ENG OVH mapping' },
    { id: 'option8', label: 'RTU/TS & COST/RTU mapping' },
    { id: 'option9', label: 'ORM Comments and Statements' },
    { id: 'option10', label: 'Service Bundle Publishing Due Date' },
  ];

  readonly section = signal<SectionId>('option1');
  readonly modal = signal<ModalId>(null);

  // Reference lookups
  readonly ethlocRef = signal<LookupItem[]>([]);
  readonly rptlocRef = signal<LookupItem[]>([]);
  readonly newsbRef = signal<LookupItem[]>([]);
  readonly newccRef = signal<LookupItem[]>([]);
  readonly sbOwnerRef = signal<LookupItem[]>([]);
  readonly horizonRef = signal<LookupItem[]>([]);
  readonly sbNameRef = signal<LookupItem[]>([]);

  // Section 1 - sbol
  readonly sbol = signal<Sbol[]>([]);
  readonly sbolChecked = new Set<string>();
  addSbolEth = '';
  addSbolRpt = '';
  addSbolTs = '';
  addSbolRtu = '';
  updSbolRow: Sbol | null = null;
  updSbolTs = '';
  updSbolRtu = '';

  // Section 2 - sb
  readonly sb = signal<Sb[]>([]);
  readonly sbChecked = new Set<string>();
  readonly sb2FilterName = signal<string>('');
  readonly sb2FilterCc = signal<string>('');
  readonly filteredSb = computed(() =>
    this.sb()
      .filter(
        (r) =>
          (!this.sb2FilterName() || r.sbname === this.sb2FilterName()) &&
          (!this.sb2FilterCc() || r.ccname === this.sb2FilterCc()),
      )
      .sort((a, b) => a.sbname.localeCompare(b.sbname)),
  );
  readonly sbNames = computed(() =>
    Array.from(new Set(this.sb().map((r) => r.sbname).filter(Boolean))).sort(),
  );
  readonly ccNames = computed(() => {
    if (!this.sb2FilterName()) {
      return Array.from(
        new Set(this.sb().map((r) => r.ccname).filter(Boolean)),
      ).sort();
    }
    // Show only CCs mapped to the selected SB
    return Array.from(
      new Set(
        this.sb()
          .filter((r) => r.sbname === this.sb2FilterName())
          .map((r) => r.ccname)
          .filter(Boolean),
      ),
    ).sort();
  });
  addSbSb = '';
  addSbCc = '';

  // Section 3 - sb owners
  readonly sbOwners = signal<Sb2sbowner[]>([]);
  readonly sbOwnerChecked = new Set<string>();
  readonly sb3FilterOwner = signal<string>('');
  readonly sb3FilterName = signal<string>('');
  readonly sbOwnerNames = computed(() => {
    const ownerMap = new Map<string, string>();
    this.sbOwners().forEach((r) => {
      if (r.persname && !ownerMap.has(r.persname)) {
        ownerMap.set(r.persname, r.persid);
      }
    });
    return Array.from(ownerMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([persname, persid]) => ({ value: persid, text: persname }));
  });
  readonly sbNamesByOwner = computed(() => {
    const selectedOwner = this.sb3FilterOwner();
    if (!selectedOwner) {
      return Array.from(
        new Set(this.sbOwners().map((r) => r.sbname).filter(Boolean)),
      )
        .sort()
        .map((sbname) => {
          const item = this.sbOwners().find((r) => r.sbname === sbname);
          return { value: item?.sb || '', text: sbname };
        });
    }
    const sbsForOwner = this.sbOwners().filter(
      (r) => r.persid === selectedOwner,
    );
    return Array.from(
      new Set(sbsForOwner.map((r) => r.sbname).filter(Boolean)),
    )
      .sort()
      .map((sbname) => {
        const item = sbsForOwner.find((r) => r.sbname === sbname);
        return { value: item?.sb || '', text: sbname };
      });
  });
  readonly sbNamesForModalOwner = computed(() => {
    if (!this.addOwnerPersId) {
      return [];
    }
    const sbsForOwner = this.sbOwners().filter(
      (r) => r.persname === this.addOwnerPersId,
    );
    return Array.from(
      new Set(sbsForOwner.map((r) => r.sbname).filter(Boolean)),
    )
      .sort()
      .map((sbname) => {
        const item = sbsForOwner.find((r) => r.sbname === sbname);
        return { value: item?.sb || '', text: sbname };
      });
  });
  readonly filteredSbOwners = computed(() =>
    this.sbOwners().filter(
      (r) =>
        (!this.sb3FilterOwner() || r.persid === this.sb3FilterOwner()) &&
        (!this.sb3FilterName() || r.sbname === this.sb3FilterName()),
    ),
  );
  addOwnerSbName = '';
  addOwnerPersId = '';
  updOwnerPersId = '';

  // Section 4 - path
  pathSb = '';
  pathLocal = '';
  pathIShare = '';
  private pathCache = new Map<string, { localPath: string; iSharePath: string }>();

  // Section 5 - email
  emailHorizon = '';
  emailFirst = '';
  emailReminder = '';
  emailRelease = '';
  private emailCache = new Map<string, { firstemail: string; reminderemail: string; releaseemail: string }>();

  // Section 6 - cost mapping
  readonly cost = signal<Sbcostmap[]>([]);
  readonly costChecked = new Set<string>();
  readonly costFilterLab = signal('');
  readonly costFilterSb = signal('');
  readonly filteredCost = computed(() => {
    const lab = this.costFilterLab();
    const sb = this.costFilterSb();
    return this.cost().filter(
      (r) => (!lab || r.rptlab === lab) && (!sb || r.sbaffected === sb),
    );
  });
  readonly costLabels = computed(() =>
    [...new Set(this.cost().map((r) => r.rptlab).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    ),
  );
  readonly costSbNames = computed(() => [
    ...new Set(this.cost().map((r) => r.sbaffected).filter(Boolean)),
  ]);
  readonly filteredCostSbNames = computed(() => {
    const lab = this.costFilterLab();
    const data = lab
      ? this.cost().filter((r) => r.rptlab === lab)
      : this.cost();
    return [...new Set(data.map((r) => r.sbaffected).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  });
  decodeHtml(text: string): string {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  }
  onCostLocationChange(lab: string) {
    this.costFilterLab.set(lab);
    this.costFilterSb.set('');
  }
  costEditId: string | null = null;
  updCostHadCc = false;
  costCc = '';
  costLab = '';
  costWbs = '';
  costSb = '';
  costPct: number | null = null;
  costClientCc = '';
  costCcPct: number | null = null;

  // Section 7 - engovh
  readonly engovh = signal<Sbengovh[]>([]);
  readonly engovhChecked = new Set<string>();
  readonly engovhFilterLoc = signal('');
  readonly engovhFilterCc = signal('');
  readonly engovhLocLookup = signal<LookupItem[]>([]);
  readonly engovhCcLookup = signal<LookupItem[]>([]);
  readonly engovhLocOptions = computed(() => {
    const lookup = this.engovhLocLookup();
    if (lookup.length > 0) return lookup;
    return [...new Set(this.engovh().map((r) => r.loc).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((loc) => ({ value: loc, text: loc }));
  });
  readonly engovhCcOptions = computed(() => {
    const lookup = this.engovhCcLookup();
    if (lookup.length > 0) return lookup;
    return [...new Set(this.engovh().map((r) => r.cc).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((cc) => ({ value: cc, text: cc }));
  });
  readonly filteredEngovhCcOptions = computed(() => {
    const loc = this.engovhFilterLoc();
    if (!loc) return this.engovhCcOptions();
    const ccsForLoc = new Set(
      this.engovh()
        .filter((r) => r.loc === loc)
        .map((r) => r.cc),
    );
    return this.engovhCcOptions().filter((i) => ccsForLoc.has(i.text));
  });
  readonly filteredEngovh = computed(() =>
    this.engovh().filter(
      (r) =>
        (!this.engovhFilterLoc() || r.loc === this.engovhFilterLoc()) &&
        (!this.engovhFilterCc() || r.cc === this.engovhFilterCc()),
    ),
  );
  onEngovhLocChange(loc: string) {
    this.engovhFilterLoc.set(loc);
    this.engovhFilterCc.set('');
  }
  engEditId: string | null = null;
  engLoc = '';
  engCc = '';
  engVal: number | null = null;
  engFy = '';

  // Section 8 - sballmap
  readonly sballmap = signal<Sballmap[]>([]);
  readonly sballmapFilterFy = signal('');
  readonly sballmapFilterLoc = signal('');
  readonly sballmapFyOptions = computed(() =>
    [...new Set(this.sballmap().map((r) => r.fy).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a)),
  );
  readonly sballmapLocOptions = computed(() => {
    const fy = this.sballmapFilterFy();
    const data = fy ? this.sballmap().filter((r) => r.fy === fy) : this.sballmap();
    return [...new Set(data.map((r) => r.loc).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  });
  readonly filteredSballmap = computed(() =>
    this.sballmap().filter(
      (r) =>
        (!this.sballmapFilterFy() || r.fy === this.sballmapFilterFy()) &&
        (!this.sballmapFilterLoc() || r.loc === this.sballmapFilterLoc()),
    ),
  );
  onSballmapFyChange(fy: string) {
    this.sballmapFilterFy.set(fy);
    this.sballmapFilterLoc.set('');
  }

  // Section 9 - ORM
  ormHorizon = '';
  ormStatement = '';

  // Section 10 - due date
  dueDateHorizon = '';
  dueDateValue = '';
  readonly dueDateStatus = signal<{
    type: 'success' | 'danger';
    message: string;
  } | null>(null);

  // Auto-reset CC filter when SB filter changes
  private sb2FilterEffect = effect(() => {
    this.sb2FilterName(); // track SB filter changes
    this.sb2FilterCc.set(''); // reset CC filter whenever SB changes
  });

  private sb3FilterEffect = effect(() => {
    this.sb3FilterOwner(); // track Owner filter changes
    this.sb3FilterName.set(''); // reset SB Name filter whenever Owner changes
  });

  ngOnInit(): void {
    this.loadAllRefs();
    this.loadSection('option1');
  }

  // ---------- Helpers ----------
  setSection(id: SectionId) {
    this.section.set(id);
    this.loadSection(id);
  }

  closeModal() {
    this.modal.set(null);
  }

  allChecked<T extends Record<string, any>>(
    items: T[],
    set: Set<string>,
    idField: keyof T,
  ): boolean {
    return items.length > 0 && items.every((i) => set.has(String(i[idField])));
  }

  toggleAll<T extends Record<string, any>>(
    items: T[],
    set: Set<string>,
    checked: boolean,
    idField: keyof T,
  ) {
    if (checked) items.forEach((i) => set.add(String(i[idField])));
    else items.forEach((i) => set.delete(String(i[idField])));
  }

  toggleOne(set: Set<string>, id: string, checked: boolean) {
    if (checked) set.add(id);
    else set.delete(id);
  }

  toggleOwnerRows(row: Sb2sbowner, checked: boolean) {
    const rowsForOwner = this.sbOwners().filter((r) => r.persid === row.persid);
    rowsForOwner.forEach((r) => {
      if (checked) this.sbOwnerChecked.add(r.sb);
      else this.sbOwnerChecked.delete(r.sb);
    });
  }

  // ---------- Loaders ----------
  private loadAllRefs() {
    this.api.listExtLocation().subscribe((r) => this.ethlocRef.set(r));
    this.api.listRptLocation().subscribe((r) => this.rptlocRef.set(r));

    // Load SB data and SB Owners to build complete SB list
    this.api.listSb().subscribe((sbData) => {
      this.sb.set(sbData);

      // Extract unique CC names (by ccid to avoid duplicates), filter out empty values
      const ccMap = new Map<string, string>();
      sbData.forEach((s) => {
        if (!ccMap.has(s.ccid) && s.ccname && s.ccname.trim() !== '') {
          ccMap.set(s.ccid, s.ccname);
        }
      });
      const uniqueCcs = Array.from(ccMap)
        .map(([value, text]) => ({ value, text }))
        .sort((a, b) => a.text.localeCompare(b.text));
      this.newccRef.set(uniqueCcs);
    });

    // Load SB Owners to get all SBs (including ones without CC mappings)
    this.api.listSbOwners().subscribe((sbOwnerData) => {
      const sbMap = new Map<string, string>();
      sbOwnerData.forEach((s) => {
        if (!sbMap.has(s.sb)) {
          sbMap.set(s.sb, s.sbname);
        }
      });
      const uniqueSbs = Array.from(sbMap)
        .map(([value, text]) => ({ value, text }))
        .sort((a, b) => a.text.localeCompare(b.text));
      this.newsbRef.set(uniqueSbs);
    });

    this.api.listRef('sbOwners').subscribe((r) => this.sbOwnerRef.set(r));
    this.api.listRef('horizons').subscribe((r) => this.horizonRef.set(r));
    this.api.listRef('sb-names').subscribe((r) => this.sbNameRef.set(r));

    // Preload ORM max horizon and statement
    this.api.getMaxHorizon().subscribe({
      next: (r) => {
        if (r.success && r.horizon) {
          this.ormHorizon = r.horizon;
          this.api.getOrmSummary(r.horizon).subscribe({
            next: (res) => {
              this.ormStatement = res.comment;
            },
          });
        }
      },
    });
  }

  private loadSection(id: SectionId) {
    switch (id) {
      case 'option1':
        this.api.listSbol().subscribe((r) => this.sbol.set(r));
        break;
      case 'option2':
        this.api.listSb().subscribe((r) => this.sb.set(r));
        break;
      case 'option3':
        this.api.listSbOwners().subscribe((r) => {
          this.sbOwners.set(r);
          this.sbNameRef.set(r.map((x) => ({ value: x.sb, text: x.sbname })));
        });
        break;
      case 'option4':
        this.pathCache.clear();
        this.api.getAllSbPaths().subscribe((paths) => {
          paths.forEach((p) => {
            this.pathCache.set(p.sbId, { localPath: p.localPath, iSharePath: p.iSharePath });
          });
        });
        break;
      case 'option5':
        this.emailCache.clear();
        this.api.getAllEmailTemplates().subscribe((templates) => {
          templates.forEach((t) => {
            this.emailCache.set(t.horizon, {
              firstemail: t.firstemail,
              reminderemail: t.reminderemail,
              releaseemail: t.releaseemail,
            });
          });
        });
        break;
      case 'option6':
        this.api.listCostMappings().subscribe((r) => this.cost.set(r));
        break;
      case 'option7':
        this.api.listEngovh().subscribe({
          next: (r) => this.engovh.set(r),
          error: (e) => console.error('Error loading eng ovh:', e),
        });
        this.api.listEngovhLocations().subscribe({
          next: (r) => this.engovhLocLookup.set(r),
          error: () => this.engovhLocLookup.set([]),
        });
        this.api.listEngovhClientCorridors().subscribe({
          next: (r) => this.engovhCcLookup.set(r),
          error: () => this.engovhCcLookup.set([]),
        });
        break;
      case 'option8':
        this.api.listSballmap().subscribe({
          next: (r) => this.sballmap.set(r),
          error: (e) => console.error('Error loading sballmap:', e),
        });
        break;
    }
  }

  // ---------- Section 1: SBOL ----------
  openAddSbol() {
    this.addSbolEth = '';
    this.addSbolRpt = '';
    this.addSbolTs = '';
    this.addSbolRtu = '';
    this.modal.set('addSbol');
  }
  saveAddSbol() {
    if (!this.addSbolEth || !this.addSbolRpt) {
      alert('Please select both locations.');
      return;
    }
    this.api
      .addSbol({
        ethloc: this.addSbolEth,
        rptloc: this.addSbolRpt,
        tstrue: this.addSbolTs,
        rtutrue: this.addSbolRtu,
      })
      .subscribe({
        next: () => {
          alert('Save successfully!');
          this.modal.set(null);
          this.loadSection('option1');
        },
        error: (e) => alert('Error: ' + (e?.error?.message ?? e.message)),
      });
  }
  openUpdateSbol() {
    const ids = [...this.sbolChecked];
    if (ids.length === 0) {
      alert('No row selected!');
      return;
    }
    if (ids.length > 1) {
      alert('Only one row can be selected for update!');
      return;
    }
    const row = this.sbol().find((r) => r.mapid === ids[0]) ?? null;
    if (!row) return;
    this.updSbolRow = row;
    this.updSbolTs = row.tstrue;
    this.updSbolRtu = row.rtutrue;
    this.modal.set('updateSbol');
  }
  saveUpdateSbol() {
    if (!this.updSbolRow) return;
    this.api
      .updateSbol(this.updSbolRow.mapid, {
        tstrue: this.updSbolTs,
        rtutrue: this.updSbolRtu,
      })
      .subscribe({
        next: () => {
          alert('Row updated successfully!');
          this.modal.set(null);
          this.sbolChecked.clear();
          this.loadSection('option1');
        },
        error: (e) => alert('Error updating row: ' + e.message),
      });
  }
  removeSbol() {
    const ids = [...this.sbolChecked];
    if (ids.length === 0) {
      alert('Please select at least one record to delete.');
      return;
    }
    if (!confirm('Delete selected rows?')) return;
    this.api.deleteSbol(ids).subscribe(() => {
      alert('Rows deleted successfully!');
      this.sbolChecked.clear();
      this.loadSection('option1');
    });
  }

  // ---------- Section 2: SB <-> CC ----------
  openAddSb() {
    this.addSbSb = '';
    this.addSbCc = '';
    // Refresh SB list from backend to include newly added SBs
    this.api.listSbOwners().subscribe({
      next: (sbOwnerData) => {
        const sbMap = new Map<string, string>();
        sbOwnerData.forEach((s) => {
          if (!sbMap.has(s.sb)) {
            sbMap.set(s.sb, s.sbname);
          }
        });
        const uniqueSbs = Array.from(sbMap)
          .map(([value, text]) => ({ value, text }))
          .sort((a, b) => a.text.localeCompare(b.text));
        this.newsbRef.set(uniqueSbs);
        this.modal.set('addSb');
      },
      error: () => this.modal.set('addSb'),
    });
  }
  saveAddSb() {
    if (!this.addSbSb || !this.addSbCc) {
      alert('Please select both SB and CC.');
      return;
    }
    const sbText =
      this.newsbRef().find((i) => i.value === this.addSbSb)?.text ??
      this.addSbSb;
    const ccText =
      this.newccRef().find((i) => i.value === this.addSbCc)?.text ??
      this.addSbCc;
    this.api
      .addSb({
        sb: this.addSbSb,
        sbname: sbText,
        ccid: this.addSbCc,
        ccname: ccText,
      })
      .subscribe({
        next: () => {
          alert('Save successfully!');
          this.modal.set(null);
          this.loadSection('option2');
        },
        error: (e) => alert('Error: ' + e.message),
      });
  }
  removeSb() {
    const ids = [...this.sbChecked];
    if (ids.length === 0) {
      alert('Please select at least one record to delete.');
      return;
    }
    if (!confirm('Are you sure you want to delete selected records?')) return;
    this.api.deleteSb(ids).subscribe({
      next: () => {
        alert('Rows deleted successfully!');
        this.sbChecked.clear();
        this.loadSection('option2');
      },
      error: (e) => alert('Error deleting: ' + (e?.error?.message ?? e.message)),
    });
  }

  // ---------- Section 3: SB Owner ----------
  openAddSbOwner() {
    this.addOwnerSbName = '';
    this.addOwnerPersId = '';
    this.modal.set('addSbOwner');
  }
  saveAddSbOwner() {
    if (!this.addOwnerSbName || !this.addOwnerPersId) {
      alert('Please fill in all fields.');
      return;
    }
    this.api
      .addSbOwner(this.addOwnerSbName, this.addOwnerPersId)
      .subscribe({
        next: (r) => {
          alert(r.message);
          this.modal.set(null);
          this.loadSection('option3');
        },
        error: (e) => alert('Error: ' + (e?.error?.message ?? e.message)),
      });
  }
  openUpdateOwner() {
    if (this.sbOwnerChecked.size === 0) {
      alert('Please select at least one service bundle to update.');
      return;
    }
    this.updOwnerPersId = '';
    this.api.listRef('sbOwners').subscribe({
      next: (r) => {
        this.sbOwnerRef.set(r);
        this.modal.set('updateOwner');
      },
      error: (e) => {
        console.error('Failed to load owners:', e);
        this.modal.set('updateOwner');
      }
    });
  }
  saveUpdateOwner() {
    if (!this.updOwnerPersId) {
      alert('Please select a new owner.');
      return;
    }
    const persName =
      this.sbOwnerRef().find((i) => i.value === this.updOwnerPersId)?.text ??
      '';
    this.api
      .updateOwner([...this.sbOwnerChecked], this.updOwnerPersId, persName)
      .subscribe({
        next: () => {
          alert('Owner updated successfully!');
          this.modal.set(null);
          this.sbOwnerChecked.clear();
          this.loadSection('option3');
        },
        error: (e) => alert('Error updating owner: ' + (e?.error?.message ?? e.message)),
      });
  }

  // ---------- Section 4: Path ----------
  loadSbPath(sb: string) {
    if (!sb) {
      this.pathLocal = '';
      this.pathIShare = '';
      return;
    }
    const cached = this.pathCache.get(sb);
    if (cached) {
      this.pathLocal = cached.localPath;
      this.pathIShare = cached.iSharePath;
    } else {
      this.pathLocal = '';
      this.pathIShare = '';
    }
  }
  saveSbPath() {
    if (!this.pathSb) {
      alert('Please select a service bundle.');
      return;
    }
    this.api
      .saveSbPath({
        selectednewsb: this.pathSb,
        localPath: this.pathLocal,
        iSharePath: this.pathIShare,
      })
      .subscribe({
        next: (r) => {
          if (r.success) {
            this.pathCache.set(this.pathSb, {
              localPath: this.pathLocal,
              iSharePath: this.pathIShare,
            });
            alert('Path updated successfully!');
          } else {
            alert('Error');
          }
        },
        error: () => alert('An unexpected error occurred.'),
      });
  }

  // ---------- Section 5: Email ----------
  loadEmailTemplate(horizon: string) {
    if (!horizon) {
      this.emailFirst = this.emailReminder = this.emailRelease = '';
      return;
    }

    // The horizon select stores the numeric id as `value`, but email templates
    // in the backend are keyed by the horizon name. Mirror the lab-cost logic
    // and translate id -> name when looking up templates.
    const horizonName = this.horizonRef().find((h) => h.value === horizon)?.text ?? horizon;

    // Try cache lookup by both id and name to be resilient to stored keys.
    const cached = this.emailCache.get(horizon) ?? this.emailCache.get(horizonName);
    if (cached) {
      this.emailFirst = cached.firstemail;
      this.emailReminder = cached.reminderemail;
      this.emailRelease = cached.releaseemail;
    } else {
      // If cache miss, attempt to fetch the template directly from the backend
      this.emailFirst = this.emailReminder = this.emailRelease = '';
      this.api.getEmailTemplate(horizonName).subscribe({
        next: (res) => {
          this.emailFirst = res.firstemail ?? '';
          this.emailReminder = res.reminderemail ?? '';
          this.emailRelease = res.releaseemail ?? '';
          // populate cache for future lookups
          this.emailCache.set(horizon, {
            firstemail: this.emailFirst,
            reminderemail: this.emailReminder,
            releaseemail: this.emailRelease,
          });
          this.emailCache.set(horizonName, {
            firstemail: this.emailFirst,
            reminderemail: this.emailReminder,
            releaseemail: this.emailRelease,
          });
        },
        error: () => {
          // leave fields empty on error
        }
      });
    }
  }
  saveEmailTemplate() {
    if (!this.emailHorizon) return;
    // Convert selected horizon id -> horizon name before saving to backend
    const horizonName = this.horizonRef().find((h) => h.value === this.emailHorizon)?.text ?? this.emailHorizon;
    this.api
      .saveEmailTemplate({
        horizon: horizonName,
        firstemail: this.emailFirst,
        reminderemail: this.emailReminder,
        releaseemail: this.emailRelease,
      })
      .subscribe({
        next: (r) => {
          if (r.success) {
            // Update cache for both id and name keys so subsequent lookups succeed
            this.emailCache.set(this.emailHorizon, {
              firstemail: this.emailFirst,
              reminderemail: this.emailReminder,
              releaseemail: this.emailRelease,
            });
            this.emailCache.set(horizonName, {
              firstemail: this.emailFirst,
              reminderemail: this.emailReminder,
              releaseemail: this.emailRelease,
            });
            alert('Save successfully!');
          } else {
            alert('Error');
          }
        },
        error: () => alert('An unexpected error occurred.'),
      });
  }

  // ---------- Section 6: Cost ----------
  openAddCost() {
    this.costEditId = null;
    this.costCc = this.costLab = this.costWbs = this.costSb = '';
    this.costPct = null;
    this.costClientCc = '';
    this.costCcPct = null;
    this.modal.set('addCost');
  }
  saveAddCost() {
    if (
      !this.costCc ||
      !this.costLab ||
      !this.costWbs ||
      !this.costSb ||
      this.costPct === null
    ) {
      alert('Please fill in all required fields.');
      return;
    }
    if (this.costPct < 0 || this.costPct > 1) {
      alert('Please enter a valid SB percentage between 0 and 1.');
      return;
    }
    if (this.costCcPct !== null && (this.costCcPct < 0 || this.costCcPct > 1)) {
      alert('Please enter a valid Cost Split percentage between 0 and 1.');
      return;
    }
    const sbText =
      this.newsbRef().find((i) => i.value === this.costSb)?.text ??
      this.costSb;
    const ccText =
      this.newccRef().find((i) => i.value === this.costClientCc)?.text ??
      this.costClientCc;
    const labText =
      this.rptlocRef().find((i) => i.value === this.costLab)?.text ??
      this.costLab;
    this.api
      .addCostMapping({
        costcenter: this.costCc,
        rptlabid: this.costLab,
        rptlab: labText,
        receiverwbs: this.costWbs,
        sbaffected: sbText,
        percentage: this.costPct,
        ccaffected: ccText,
        ccpercentage: this.costCcPct ?? 0,
      })
      .subscribe({
        next: () => {
          alert('Save successfully!');
          this.modal.set(null);
          this.loadSection('option6');
        },
        error: (e) => alert('Error: ' + e.message),
      });
  }
  openUpdateCost() {
    const ids = [...this.costChecked];
    if (ids.length !== 1) {
      alert('Please select exactly one cost mapping to update.');
      return;
    }
    const row = this.cost().find((r) => r.costmappingid === ids[0]);
    if (!row) return;
    this.costEditId = row.costmappingid;
    this.costCc = row.costcenter;
    this.costLab = row.rptlab;
    this.costWbs = row.receiverwbs;
    this.costSb = row.sbaffected;
    this.costPct = row.percentage;
    this.costClientCc = row.ccaffected;
    this.costCcPct = row.ccpercentage;
    this.updCostHadCc = !!row.ccaffected.trim();
    this.modal.set('updateCost');
  }
  saveUpdateCost() {
    if (!this.costEditId) return;
    if (this.costPct !== null && (this.costPct < 0 || this.costPct > 1)) {
      alert('Please enter a valid SB percentage between 0 and 1.');
      return;
    }
    if (this.costCcPct !== null && (this.costCcPct < 0 || this.costCcPct > 1)) {
      alert('Please enter a valid Cost Split percentage between 0 and 1.');
      return;
    }
    this.api
      .updateCostMapping(this.costEditId, {
        costcenter: this.costCc,
        rptlab: this.costLab,
        receiverwbs: this.costWbs,
        sbaffected: this.costSb,
        percentage: this.costPct ?? 0,
        ccaffected: this.costClientCc,
        ccpercentage: this.costCcPct ?? 0,
      })
      .subscribe({
        next: () => {
          alert('Save successfully!');
          this.modal.set(null);
          this.costChecked.clear();
          this.loadSection('option6');
        },
        error: (e) => alert('Error updating cost mapping: ' + e.message),
      });
  }
  askDeleteCost() {
    if (this.costChecked.size === 0) {
      alert('Please select a cost mapping to delete.');
      return;
    }
    this.modal.set('confirmDeleteCost');
  }
  confirmDeleteCost() {
    const id = [...this.costChecked][0];
    if (!id) return;
    this.api.deleteCostMapping(id).subscribe({
      next: () => {
        alert('Cost mapping deleted successfully!');
        this.modal.set(null);
        this.costChecked.clear();
        this.loadSection('option6');
      },
      error: (e) => alert('Error: ' + e.message),
    });
  }
  exportCost() {
    this.api
      .exportCostMappings(this.costFilterLab(), this.costFilterSb(), this.cost())
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CostMappings.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  // ---------- Section 7: ENG OVH ----------
  openAddEngovh() {
    this.engEditId = null;
    this.engLoc = this.engCc = this.engFy = '';
    this.engVal = null;
    this.modal.set('addEngovh');
  }
  saveAddEngovh() {
    if (!this.engLoc || !this.engCc || this.engVal === null || !this.engFy) {
      alert('Please fill in all fields.');
      return;
    }
    if (this.engVal < 1 || this.engVal > 10) {
      alert('ENG OVH Value must be between 1 and 10.');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(this.engFy)) {
      alert('FY must be in the format yy/yy (e.g., 24/25).');
      return;
    }
    const exists = this.engovh().some(
      (r) => r.loc === this.engLoc && r.cc === this.engCc && r.fy === this.engFy,
    );
    if (exists) {
      alert('A record with the same Location, Client Corridor, and FY already exists.');
      return;
    }
    this.api
      .addEngovh({ loc: this.engLoc, cc: this.engCc, val: this.engVal, fy: this.engFy })
      .subscribe({
        next: () => {
          alert('Added successfully!');
          this.modal.set(null);
          this.loadSection('option7');
        },
        error: (e) => alert('Error: ' + e.message),
      });
  }
  openUpdateEngovh() {
    const ids = [...this.engovhChecked];
    if (ids.length !== 1) {
      alert('Please select exactly one row to update!');
      return;
    }
    const row = this.engovh().find((r) => r.engovhid === ids[0]);
    if (!row) return;
    this.engEditId = row.engovhid;
    this.engLoc = row.loc;
    this.engCc = row.cc;
    this.engVal = row.val;
    this.engFy = row.fy;
    this.modal.set('updateEngovh');
  }
  saveUpdateEngovh() {
    if (!this.engEditId) return;
    if (this.engVal === null || this.engVal < 1 || this.engVal > 10) {
      alert('ENG OVH Value must be between 1 and 10.');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(this.engFy)) {
      alert('FY must be in the format yy/yy (e.g., 24/25).');
      return;
    }
    const exists = this.engovh().some(
      (r) =>
        r.engovhid !== this.engEditId &&
        r.loc === this.engLoc &&
        r.cc === this.engCc &&
        r.fy === this.engFy,
    );
    if (exists) {
      alert('A record with the same Location, Client Corridor, and FY already exists.');
      return;
    }
    this.api
      .updateEngovh(this.engEditId, {
        loc: this.engLoc,
        cc: this.engCc,
        val: this.engVal,
        fy: this.engFy,
      })
      .subscribe({
        next: () => {
          alert('Updated successfully!');
          this.modal.set(null);
          this.engovhChecked.clear();
          this.loadSection('option7');
        },
        error: (e) => alert('Error updating ENG OVH: ' + e.message),
      });
  }
  removeEngovh() {
    const ids = [...this.engovhChecked];
    if (ids.length === 0) {
      alert('Please select at least one row to delete.');
      return;
    }
    if (!confirm('Are you sure you want to delete selected records?')) return;
    this.api.deleteEngovh(ids).subscribe(() => {
      alert('Deleted successfully!');
      this.engovhChecked.clear();
      this.loadSection('option7');
    });
  }

  // ---------- Section 9: ORM ----------
  loadOrmSummary(horizon: string) {
    if (!horizon) {
      this.ormStatement = '';
      return;
    }
    this.api.getOrmSummary(horizon).subscribe((r) => {
      this.ormStatement = r.comment;
    });
  }
  copyPreviousOrm() {
    if (!this.ormHorizon) {
      alert('Current horizon is not set.');
      return;
    }
    if (this.ormStatement.trim()) {
      if (
        !confirm(
          'This will replace the current content with the previous horizon comment. Continue?',
        )
      )
        return;
    }
    this.api.getPreviousOrmSummary(this.ormHorizon).subscribe((r) => {
      if (r.comment) {
        this.ormStatement = r.comment;
        alert(
          'Previous horizon comment (from ' +
            r.previousHorizon +
            ') loaded successfully!',
        );
      } else {
        alert('No previous horizon comment found.');
      }
    });
  }
  saveOrm() {
    if (!this.ormHorizon) {
      alert('Current horizon is not set.');
      return;
    }
    if (!this.ormStatement.trim()) {
      alert('Please enter a statement or comment.');
      return;
    }
    this.api.saveOrmSummary(this.ormHorizon, this.ormStatement).subscribe({
      next: (r) =>
        alert(
          r.success
            ? 'ORM Summary saved successfully for ' + this.ormHorizon + '!'
            : 'Error: ' + r.message,
        ),
      error: (e) => alert('An error occurred: ' + e.message),
    });
  }
  clearOrm() {
    if (confirm('Are you sure you want to clear the current comment?')) {
      this.ormStatement = '';
    }
  }

  // ---------- Section 10: Due date ----------
  loadDueDate(horizon: string) {
    if (!horizon) {
      this.dueDateValue = '';
      return;
    }
    this.api.getDueDate(horizon).subscribe((r) => {
      this.dueDateValue = r.dueDate ?? '';
    });
  }
  saveDueDate() {
    if (!this.dueDateValue) {
      this.flashDueDate('Please select a due date', 'danger');
      return;
    }
    if (!this.dueDateHorizon) {
      this.flashDueDate('Horizon is not set', 'danger');
      return;
    }
    this.api.saveDueDate(this.dueDateHorizon, this.dueDateValue).subscribe({
      next: (r) =>
        this.flashDueDate(
          r.success
            ? 'Due date saved successfully for ' + this.dueDateHorizon
            : 'Error: ' + r.message,
          r.success ? 'success' : 'danger',
        ),
      error: (e) =>
        this.flashDueDate('An error occurred: ' + e.message, 'danger'),
    });
  }
  clearDueDate() {
    if (!this.dueDateHorizon) {
      this.flashDueDate('Horizon is not set', 'danger');
      return;
    }
    if (!confirm('Are you sure you want to clear the due date?')) return;
    this.api.deleteDueDate(this.dueDateHorizon).subscribe({
      next: (r) => {
        if (r.success) {
          this.dueDateValue = '';
          this.flashDueDate('Due date cleared', 'success');
        } else {
          this.flashDueDate('Error clearing due date', 'danger');
        }
      },
      error: (e) => this.flashDueDate('An error occurred: ' + e.message, 'danger'),
    });
  }
  private flashDueDate(message: string, type: 'success' | 'danger') {
    this.dueDateStatus.set({ type, message });
    setTimeout(() => this.dueDateStatus.set(null), 3000);
  }
}
