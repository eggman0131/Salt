import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabs = [
  {
    name: 'Categories',
    value: 'categories',
    count: 12,
    content: (
      <>
        Manage recipe <span className='text-foreground font-semibold'>categories</span> and classifications. Organize your culinary collection with custom tags and approvals.
      </>
    )
  },
  {
    name: 'Items',
    value: 'items',
    count: 48,
    content: (
      <>
        All your <span className='text-foreground font-semibold'>canonical items</span>—ingredients, household items, and more. Assign preferred units, aisles, and add synonyms for better search.
      </>
    )
  },
  {
    name: 'Units',
    value: 'units',
    count: 15,
    content: (
      <>
        <span className='text-foreground font-semibold'>Measurement units</span> for your kitchen. Create custom units, set defaults, and organize by type.
      </>
    )
  },
  {
    name: 'Aisles',
    value: 'aisles',
    count: 8,
    content: (
      <>
        <span className='text-foreground font-semibold'>Shop aisles</span> and locations. Organize your shopping by supermarket layout and reorder items by frequency.
      </>
    )
  }
]

const TabsWithBadgeDemo = () => {
  return (
    <div className='w-full'>
      <Tabs defaultValue='categories' className='gap-4'>
        <TabsList className='grid w-full grid-cols-4'>
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className='flex items-center gap-2 px-2.5 sm:px-3'>
              {tab.name}
              <Badge className="h-5 min-w-5 px-1 tabular-nums flex items-center justify-center">{tab.count}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            <p className='text-muted-foreground text-sm'>{tab.content}</p>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default TabsWithBadgeDemo
