'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { createCatalogItemAction } from '@/app/actions/catalog'
import { CatalogItemForm } from '@/components/catalogo/catalog-item-form'
import { CatalogTable } from '@/components/catalogo/catalog-table'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { CatalogItem } from '@/types'

type CatalogPageContentProps = {
  items: CatalogItem[]
  search: string
  currency: string | null
  categorySuggestions: string[]
  unitSuggestions: string[]
}

export function CatalogPageContent({
  items,
  search,
  currency,
  categorySuggestions,
  unitSuggestions,
}: CatalogPageContentProps) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-6 pb-20">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-[11px] font-medium text-muted-foreground">
          Catálogo
        </span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              Productos y servicios disponibles
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Guardá tus productos y servicios para usarlos rápido al cotizar.
            </p>
          </div>
          <Button
            type="button"
            className="min-h-12 w-full sm:w-auto"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-2 h-5 w-5" />
            Agregar producto o servicio
          </Button>
        </div>
      </section>

      <CatalogTable
        items={items}
        search={search}
        currency={currency}
        categorySuggestions={categorySuggestions}
        unitSuggestions={unitSuggestions}
      />

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto border-token bg-surface"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Agregar producto o servicio</SheetTitle>
          </SheetHeader>
          <CatalogItemForm
            submitLabel="Guardar"
            categorySuggestions={categorySuggestions}
            unitSuggestions={unitSuggestions}
            onSubmit={createCatalogItemAction}
            onSuccess={() => setAddOpen(false)}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
