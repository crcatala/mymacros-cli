import { type Command, Help } from 'commander'
import type { CliContext } from './context.js'

class StyledHelp extends Help {
  constructor(private ctx: CliContext) {
    super()
  }

  styleTitle(title: string): string {
    return this.ctx.colors.section(title)
  }

  styleCommandText(text: string): string {
    return this.ctx.colors.command(text)
  }

  styleOptionTerm(text: string): string {
    return this.ctx.colors.option(text)
  }

  styleSubcommandTerm(text: string): string {
    return this.ctx.colors.command(text)
  }

  styleOptionDescription(text: string): string {
    return this.styleMetadata(text)
  }

  styleSubcommandDescription(text: string): string {
    return this.styleMetadata(text)
  }

  private styleMetadata(text: string): string {
    return text.replace(/\((?:default|choices): [^)]+\)/g, (match) => this.ctx.colors.muted(match))
  }
}

/** Apply the shared Commander help styling to a root command and its subcommands. */
export function configureStyledHelp(program: Command, ctx: CliContext): void {
  const help = new StyledHelp(ctx)
  program.configureHelp({
    showGlobalOptions: true,
    styleTitle: (text) => help.styleTitle(text),
    styleCommandText: (text) => help.styleCommandText(text),
    styleOptionTerm: (text) => help.styleOptionTerm(text),
    styleOptionDescription: (text) => help.styleOptionDescription(text),
    styleSubcommandTerm: (text) => help.styleSubcommandTerm(text),
    styleSubcommandDescription: (text) => help.styleSubcommandDescription(text),
  })

  for (const command of program.commands) configureStyledHelp(command, ctx)
}
