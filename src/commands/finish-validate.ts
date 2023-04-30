import {
  ChatInputCommandInteraction,
  GuildMemberRoleManager,
  PermissionFlagsBits,
  PermissionsBitField,
  Role,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';
import { DisciplineChannel, DisciplineEnrollment } from '@prisma/client';
import { TokenService } from '../services/token.service';
import { TokenRepository } from '../repository/Token.repository';
import { prisma } from '../config';
import { DisciplineChannelService } from '../services/disciplineChannel.service';
import { DisciplineChannelRepository } from '../repository/DisciplineChannel.repository';
import { DisciplineEnrollmentService } from '../services/disciplineEnrollment.service';
import { DisciplineEnrollmentRepository } from '../repository/DisciplineEnrollment.repository';
import { EnrolledStudentService } from '../services/enrolledStudent.service';
import { EnrolledStudentRepository } from '../repository/EnrolledStudent.repository';

const tokenService = new TokenService(new TokenRepository(prisma));

const channelsService = new DisciplineChannelService(
  new DisciplineChannelRepository(prisma)
);

const enrolledDisciplinesService = new DisciplineEnrollmentService(
  new DisciplineEnrollmentRepository(prisma)
);

const studentService = new EnrolledStudentService(
  new EnrolledStudentRepository(prisma)
);

const addUserToStudentRole = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const studentRole = interaction.guild.roles.cache.find(
    (role: Role): boolean => role.name === 'ESTUDANTE'
  );

  await (interaction.member.roles as GuildMemberRoleManager).add(studentRole);
};

const addUserToProperChannels = async (
  interaction: ChatInputCommandInteraction,
  channels: Array<DisciplineChannel>
): Promise<void> => {
  const channelManager = interaction.guild.channels;
  const member = interaction.member.user.id;

  channels.forEach(async (channel: DisciplineChannel): Promise<void> => {
    await channelManager.edit(channel.channelId, {
      permissionOverwrites: [
        {
          id: member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });
  });
};

const finishValidationCommand = new SlashCommandBuilder()
  .setName('finalizar-validacao')
  .setDescription('Esse comando finaliza a validacão do aluno no servidor.')
  .addStringOption(
    (option: SlashCommandStringOption): SlashCommandStringOption =>
      option
        .setName('token')
        .setDescription('Token de validacão')
        .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

const finishValidationCommandInteraction = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const tokenOption = interaction.options.getString('token');

  const isValidToken = await tokenService.isValidToken(tokenOption);

  if (isValidToken.isValid) {
    await interaction.reply(
      `Token ${tokenOption} verificado com sucesso. Voce será adicionado aos seus canais respectivos.`
    );

    await addUserToStudentRole(interaction);

    const student = await studentService.getEnrolledStudentByEnrollmentId(
      isValidToken.token?.enrollmentId
    );

    const studentDisciplines =
      await enrolledDisciplinesService.getStudentDisciplines(
        student.enrollmentId
      );

    const channels = await channelsService.getChannelsByDisciplineIds(
      studentDisciplines.map(
        (el: DisciplineEnrollment): string => el.disciplineId
      )
    );

    addUserToProperChannels(interaction, channels);
  } else {
    await interaction.reply(`Falha na verificacão do token ${tokenOption}`);
  }
};

export { finishValidationCommand, finishValidationCommandInteraction };
