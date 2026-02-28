# Design Patterns — Exemples de code valides

> Chaque exemple ici est un pattern **anti-AI** valide. Un designer humain reconnaitrait ce code comme du craft, pas comme un output.

---

## 1. Hero Section — Produit en avant (pas H1 centre generique)

```tsx
// BIEN : le produit est visible, asymetrique, pas de H1 centre generique
export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          {/* Texte — cote gauche, plus large */}
          <div className="max-w-xl">
            <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              Pour les equipes produit
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight
              text-foreground sm:text-5xl lg:text-6xl leading-[1.1]">
              Planifiez. Construisez.
              <span className="text-primary"> Livrez.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-md">
              L'outil de gestion de projet qui s'adapte a votre workflow,
              pas l'inverse.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Button size="lg">Commencer gratuitement</Button>
              <Button variant="ghost" size="lg" className="text-muted-foreground">
                Voir la demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Produit — screenshot reel, pas un mockup */}
          <div className="relative">
            <div className="rounded-lg border border-border shadow-md overflow-hidden
              bg-card">
              <Image
                src="/app-screenshot.webp"
                alt="Interface de gestion de projet montrant un board Kanban"
                width={800}
                height={520}
                className="w-full"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

---

## 2. Feature Section — Layout asymetrique (pas 3 colonnes identiques)

```tsx
// BIEN : layout asymetrique, hierarchie claire, pas de grille d'icones
export function FeatureSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary">Fonctionnalites</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Tout ce dont votre equipe a besoin
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Chaque fonctionnalite a ete concue pour eliminer la friction,
            pas pour remplir une page marketing.
          </p>
        </div>

        {/* Layout 2:1 — feature highlight + liste */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12">
          {/* Feature principale — grande, detaillee */}
          <Card className="border border-border shadow-none overflow-hidden">
            <div className="aspect-[16/10] bg-muted" />
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold tracking-tight">
                Board temps reel
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Synchronisation instantanee entre tous les membres.
                Pas de refresh, pas de conflit.
              </p>
            </CardContent>
          </Card>

          {/* Features secondaires — empilees, compactes */}
          <div className="flex flex-col gap-4">
            {features.map((feature) => (
              <Card key={feature.title}
                className="border border-border shadow-none p-4
                  transition-colors duration-150 hover:bg-accent/50">
                <h3 className="text-sm font-medium">{feature.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
```

---

## 3. Dashboard Card — Variantes et hierarchie

```tsx
// BIEN : 3 variantes de cards, hierarchie visuelle claire
export function DashboardCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.8fr] gap-4">
      {/* Card metrique hero — plus grande, shadow */}
      <Card className="md:col-span-2 border-0 shadow-md bg-card">
        <CardHeader className="pb-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide
            text-muted-foreground">
            Revenu mensuel
          </CardDescription>
          <CardTitle className="text-3xl font-bold tracking-tight tabular-nums">
            24 580 &euro;
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              +12.5%
            </span>
            {" "}vs mois dernier
          </p>
        </CardContent>
      </Card>

      {/* Card secondaire — bordure, pas d'ombre */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-2">
          <CardDescription className="text-xs font-medium uppercase tracking-wide
            text-muted-foreground">
            Utilisateurs actifs
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">
            1 247
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              +3.2%
            </span>
            {" "}vs semaine derniere
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 4. Navigation — Sobre, accessible

```tsx
// BIEN : navigation minimaliste, focus visible, mobile hamburger
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border
      bg-background/80 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-6">
        <div className="flex items-center gap-2">
          <Logo className="h-5 w-5" />
          <span className="font-semibold text-sm tracking-tight">Produit</span>
        </div>

        <nav className="ml-8 hidden md:flex items-center gap-6">
          {links.map((link) => (
            <a key={link.href} href={link.href}
              className="text-sm text-muted-foreground transition-colors duration-150
                hover:text-foreground focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                rounded-sm">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Connexion
          </Button>
          <Button size="sm">Essai gratuit</Button>
        </div>
      </div>
    </header>
  )
}
```

---

## 5. Form — Labels visibles, validation inline, etats complets

```tsx
// BIEN : labels au-dessus, validation inline, focus auto, fieldset
export function LoginForm() {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entrez vos identifiants pour acceder a votre compte
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="vous@exemple.com"
                    autoFocus
                    autoComplete="email"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-medium">Mot de passe</FormLabel>
                  <a href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground
                      transition-colors duration-150">
                    Mot de passe oublie ?
                  </a>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    className="h-10"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full h-10"
            disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <a href="/signup"
          className="text-foreground font-medium hover:underline
            underline-offset-4 transition-colors duration-150">
          Creer un compte
        </a>
      </p>
    </div>
  )
}
```

---

## 6. Table — Lisible, header sticky, nombres alignes

```tsx
// BIEN : alternance subtile, nombres a droite, header sticky
export function UsersTable({ users }: { users: User[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0">
          <TableRow>
            <TableHead className="text-xs font-medium uppercase tracking-wide
              text-muted-foreground">
              Nom
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wide
              text-muted-foreground">
              Email
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wide
              text-muted-foreground text-right">
              Projets
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wide
              text-muted-foreground text-right">
              Dernier actif
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}
              className="transition-colors duration-100 hover:bg-muted/30">
              <TableCell className="font-medium text-sm">{user.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.email}
              </TableCell>
              <TableCell className="text-sm tabular-nums text-right">
                {user.projectCount}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground text-right">
                {formatRelative(user.lastActive)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

---

## 7. Pricing — Asymetrie et hierarchie visuelle

```tsx
// BIEN : plan recommande mis en avant avec shadow, pas 3 cards identiques
export function PricingSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight">Tarifs simples</h2>
          <p className="mt-3 text-muted-foreground">
            Pas de surprise. Pas de frais caches.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-[1fr_1.15fr_1fr] gap-6
          items-start">
          {/* Starter — compact */}
          <Card className="border border-border shadow-none p-6">
            <p className="text-sm font-medium text-muted-foreground">Starter</p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">0 &euro;</span>
              <span className="text-sm text-muted-foreground">/mois</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-foreground" />
                3 projets
              </li>
              {/* ... */}
            </ul>
            <Button variant="secondary" className="w-full mt-8">Commencer</Button>
          </Card>

          {/* Pro — MIS EN AVANT (plus grand, shadow, badge) */}
          <Card className="border-0 shadow-md p-6 relative">
            <div className="absolute -top-3 left-6">
              <span className="bg-primary text-primary-foreground text-xs
                font-medium px-3 py-1 rounded-full">
                Populaire
              </span>
            </div>
            <p className="text-sm font-medium">Pro</p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">29 &euro;</span>
              <span className="text-sm text-muted-foreground">/mois</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Projets illimites
              </li>
              {/* ... */}
            </ul>
            <Button className="w-full mt-8">Choisir Pro</Button>
          </Card>

          {/* Enterprise — sobre */}
          <Card className="border border-border shadow-none p-6">
            <p className="text-sm font-medium text-muted-foreground">Enterprise</p>
            <p className="mt-4 text-3xl font-bold tracking-tight">Sur mesure</p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-foreground" />
                SSO + SAML
              </li>
              {/* ... */}
            </ul>
            <Button variant="secondary" className="w-full mt-8">Nous contacter</Button>
          </Card>
        </div>
      </div>
    </section>
  )
}
```

---

## 8. Empty State — Utile, pas decoratif

```tsx
// BIEN : message clair, action directe, pas de blob SVG decoratif
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
        <FolderOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-medium">Aucun projet</h3>
      <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
        Creez votre premier projet pour commencer a organiser votre travail.
      </p>
      <Button size="sm" className="mt-4">
        <Plus className="mr-2 h-4 w-4" />
        Nouveau projet
      </Button>
    </div>
  )
}
```
